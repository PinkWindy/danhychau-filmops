import uuid
import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from database import SessionLocal, DbStaff, DbTeam, DbTeamMember, DbJobCard, DbRequest

router = APIRouter(prefix="/api/hr", tags=["HR"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Pydantic Schemas ---

class StaffBase(BaseModel):
    full_name: str
    title: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    join_date: Optional[str] = None
    skill_level: Optional[str] = None
    status: Optional[str] = "ACTIVE"

class StaffCreate(StaffBase):
    pass

class StaffUpdate(StaffBase):
    pass

class StaffResponse(StaffBase):
    staff_id: str
    created_at: str

    class Config:
        orm_mode = True

class TeamBase(BaseModel):
    team_name: str
    team_type: str
    status: Optional[str] = "ACTIVE"

class TeamCreate(TeamBase):
    pass

class TeamUpdate(TeamBase):
    pass

class TeamMemberResponse(BaseModel):
    staff_id: str
    full_name: str
    role: str

class TeamResponse(TeamBase):
    team_id: str
    created_at: str
    members: List[TeamMemberResponse] = []

    class Config:
        orm_mode = True

class TeamMemberAssign(BaseModel):
    staff_id: str
    role: Optional[str] = "MEMBER"

# --- Performance Schemas ---

class StaffPerformanceResponse(BaseModel):
    staff_id: str
    full_name: str
    total_assigned: int
    total_completed: int
    completion_rate: float
    on_time_rate: float

class JobDetailResponse(BaseModel):
    job_card_id: str
    request_id: str
    vehicle_model_code: str
    vin_masked: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    status: str
    is_on_time: Optional[bool] = None

# --- API Endpoints ---

@router.get("/performance", response_model=List[StaffPerformanceResponse])
def get_staff_performance(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Lấy danh sách KTV kèm các chỉ số thống kê hiệu suất:
    - Tổng công việc (job_cards) được giao.
    - Số công việc đã hoàn thành.
    - Tỷ lệ hoàn thành.
    - Tỷ lệ giao đúng hạn.
    """
    staff_list = db.query(DbStaff).filter(DbStaff.status != "DELETED").all()
    
    # Lấy tất cả job cards
    query = db.query(DbJobCard)
    if start_date:
        query = query.filter(DbJobCard.created_at >= start_date)
    if end_date:
        query = query.filter(DbJobCard.created_at <= end_date)
        
    all_jobs = query.all()
    
    # Nhóm job theo technician_id
    jobs_by_tech = {}
    for job in all_jobs:
        tech_id = job.technician_id
        if not tech_id:
            continue
        if tech_id not in jobs_by_tech:
            jobs_by_tech[tech_id] = []
        jobs_by_tech[tech_id].append(job)
        
    results = []
    for staff in staff_list:
        jobs = jobs_by_tech.get(staff.staff_id, [])
        total_assigned = len(jobs)
        
        # Công việc đã hoàn thành (COMPLETED hoặc CLOSED, hoặc có completed_at)
        completed_jobs = [j for j in jobs if j.status in ("COMPLETED", "CLOSED", "COMPLETED_BY_TECHNICIAN") or j.completed_at]
        total_completed = len(completed_jobs)
        
        on_time_jobs = [j for j in completed_jobs if j.is_on_time is True or j.delay_minutes == 0]
        total_on_time = len(on_time_jobs)
        
        completion_rate = (total_completed / total_assigned * 100) if total_assigned > 0 else 0.0
        on_time_rate = (total_on_time / total_completed * 100) if total_completed > 0 else 0.0
        
        if total_assigned > 0: # Chỉ trả về những KTV có job
            results.append({
                "staff_id": staff.staff_id,
                "full_name": staff.full_name,
                "total_assigned": total_assigned,
                "total_completed": total_completed,
                "completion_rate": round(completion_rate, 2),
                "on_time_rate": round(on_time_rate, 2)
            })
            
    return results

@router.get("/performance/{staff_id}/jobs", response_model=List[JobDetailResponse])
def get_staff_jobs_detail(
    staff_id: str,
    db: Session = Depends(get_db)
):
    """
    Lấy chi tiết danh sách các xe / công việc mà KTV đã và đang thực hiện.
    """
    jobs = db.query(DbJobCard).filter(DbJobCard.technician_id == staff_id).order_by(DbJobCard.created_at.desc()).all()
    
    result = []
    for job in jobs:
        # Fetch request details for VIN/Plate if needed
        req = db.query(DbRequest).filter(DbRequest.request_id == job.request_id).first()
        vin_masked = req.vin_masked if req else None
        
        result.append({
            "job_card_id": job.job_card_id,
            "request_id": job.request_id,
            "vehicle_model_code": job.vehicle_model_code or "",
            "vin_masked": vin_masked,
            "started_at": job.started_at,
            "completed_at": job.completed_at,
            "status": job.status,
            "is_on_time": job.is_on_time
        })
        
    return result

@router.get("/staff", response_model=List[StaffResponse])
def get_staff(db: Session = Depends(get_db)):
    staff = db.query(DbStaff).filter(DbStaff.status != "DELETED").order_by(DbStaff.created_at.desc()).all()
    return staff

@router.post("/staff", response_model=StaffResponse)
def create_staff(staff: StaffCreate, db: Session = Depends(get_db)):
    db_staff = DbStaff(
        staff_id=f"STF-{uuid.uuid4().hex[:8].upper()}",
        full_name=staff.full_name,
        title=staff.title,
        phone_number=staff.phone_number,
        email=staff.email,
        join_date=staff.join_date,
        skill_level=staff.skill_level,
        status=staff.status or "ACTIVE",
        created_at=datetime.datetime.now().isoformat()
    )
    db.add(db_staff)
    db.commit()
    db.refresh(db_staff)
    return db_staff

@router.put("/staff/{staff_id}", response_model=StaffResponse)
def update_staff(staff_id: str, staff: StaffUpdate, db: Session = Depends(get_db)):
    db_staff = db.query(DbStaff).filter(DbStaff.staff_id == staff_id).first()
    if not db_staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    db_staff.full_name = staff.full_name
    db_staff.title = staff.title
    db_staff.phone_number = staff.phone_number
    db_staff.email = staff.email
    db_staff.join_date = staff.join_date
    db_staff.skill_level = staff.skill_level
    db_staff.status = staff.status
    
    db.commit()
    db.refresh(db_staff)
    return db_staff

@router.delete("/staff/{staff_id}")
def delete_staff(staff_id: str, db: Session = Depends(get_db)):
    db_staff = db.query(DbStaff).filter(DbStaff.staff_id == staff_id).first()
    if not db_staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    db_staff.status = "DELETED"
    
    # Optional: Remove from all teams
    db.query(DbTeamMember).filter(DbTeamMember.staff_id == staff_id).delete()
    
    db.commit()
    return {"status": "success"}

@router.get("/teams", response_model=List[TeamResponse])
def get_teams(db: Session = Depends(get_db)):
    teams = db.query(DbTeam).filter(DbTeam.status != "DELETED").order_by(DbTeam.created_at.desc()).all()
    
    result = []
    for team in teams:
        team_dict = {
            "team_id": team.team_id,
            "team_name": team.team_name,
            "team_type": team.team_type,
            "status": team.status,
            "created_at": team.created_at,
            "members": []
        }
        
        # Get members
        members = db.query(DbTeamMember, DbStaff).join(DbStaff, DbTeamMember.staff_id == DbStaff.staff_id)\
                    .filter(DbTeamMember.team_id == team.team_id).all()
        
        for tm, stf in members:
            team_dict["members"].append({
                "staff_id": stf.staff_id,
                "full_name": stf.full_name,
                "role": tm.role
            })
            
        result.append(team_dict)
        
    return result

@router.post("/teams", response_model=TeamResponse)
def create_team(team: TeamCreate, db: Session = Depends(get_db)):
    db_team = DbTeam(
        team_id=f"TM-{uuid.uuid4().hex[:8].upper()}",
        team_name=team.team_name,
        team_type=team.team_type,
        status=team.status or "ACTIVE",
        created_at=datetime.datetime.now().isoformat()
    )
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    
    return {
        "team_id": db_team.team_id,
        "team_name": db_team.team_name,
        "team_type": db_team.team_type,
        "status": db_team.status,
        "created_at": db_team.created_at,
        "members": []
    }

@router.put("/teams/{team_id}", response_model=TeamResponse)
def update_team(team_id: str, team: TeamUpdate, db: Session = Depends(get_db)):
    db_team = db.query(DbTeam).filter(DbTeam.team_id == team_id).first()
    if not db_team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    db_team.team_name = team.team_name
    db_team.team_type = team.team_type
    db_team.status = team.status
    
    db.commit()
    
    # Return updated team with members
    members = db.query(DbTeamMember, DbStaff).join(DbStaff, DbTeamMember.staff_id == DbStaff.staff_id)\
                .filter(DbTeamMember.team_id == team_id).all()
                
    mem_list = []
    for tm, stf in members:
        mem_list.append({
            "staff_id": stf.staff_id,
            "full_name": stf.full_name,
            "role": tm.role
        })
        
    return {
        "team_id": db_team.team_id,
        "team_name": db_team.team_name,
        "team_type": db_team.team_type,
        "status": db_team.status,
        "created_at": db_team.created_at,
        "members": mem_list
    }

@router.delete("/teams/{team_id}")
def delete_team(team_id: str, db: Session = Depends(get_db)):
    db_team = db.query(DbTeam).filter(DbTeam.team_id == team_id).first()
    if not db_team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    db_team.status = "DELETED"
    
    # Remove all members from this team
    db.query(DbTeamMember).filter(DbTeamMember.team_id == team_id).delete()
    
    db.commit()
    return {"status": "success"}

@router.post("/teams/{team_id}/members")
def assign_team_member(team_id: str, member: TeamMemberAssign, db: Session = Depends(get_db)):
    db_team = db.query(DbTeam).filter(DbTeam.team_id == team_id).first()
    if not db_team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    db_staff = db.query(DbStaff).filter(DbStaff.staff_id == member.staff_id).first()
    if not db_staff:
        raise HTTPException(status_code=404, detail="Staff not found")
        
    # Check if already assigned
    existing = db.query(DbTeamMember).filter(
        DbTeamMember.team_id == team_id,
        DbTeamMember.staff_id == member.staff_id
    ).first()
    
    if existing:
        existing.role = member.role
    else:
        new_member = DbTeamMember(
            id=str(uuid.uuid4()),
            team_id=team_id,
            staff_id=member.staff_id,
            role=member.role,
            created_at=datetime.datetime.now().isoformat()
        )
        db.add(new_member)
        
    db.commit()
    return {"status": "success"}

@router.delete("/teams/{team_id}/members/{staff_id}")
def remove_team_member(team_id: str, staff_id: str, db: Session = Depends(get_db)):
    db.query(DbTeamMember).filter(
        DbTeamMember.team_id == team_id,
        DbTeamMember.staff_id == staff_id
    ).delete()
    
    db.commit()
    return {"status": "success"}
