import os
import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

class OcrResult(BaseModel):
    dealer_name: str = Field(description="Tên đại lý (Dealer name)")
    customer_name: str = Field(description="Tên khách hàng (Customer name)")
    vehicle_model: str = Field(description="Dòng xe / Model xe (Vehicle model)")
    vin: str = Field(description="Số khung / VIN (Vehicle Identification Number)")
    film_type: str = Field(description="Loại phim / Hạng mục dán (Film type)")
    job_items: str = Field(description="Các vị trí dán phim (ví dụ: WINDSHIELD, REAR_WINDOW, FRONT_SIDE, REAR_SIDE_TRIANGLE, SUNROOF, PPF_FULL). Ghi cách nhau bởi dấu phẩy.")
    delivery_time: str = Field(description="Thời gian giao xe (nếu có, format ISO 8601 hoặc để trống)")
    sales_consultant: str = Field(description="Tên tư vấn bán hàng / Sales (nếu có)")
    request_date: str = Field(description="Ngày yêu cầu trên phiếu")
    address: str = Field(description="Địa chỉ khách hàng")

def extract_text_from_image_gemini(image_path: str) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "Thiếu cấu hình GEMINI_API_KEY trong .env"}
        
    try:
        client = genai.Client(api_key=api_key)
        
        # Determine mime type
        ext = os.path.splitext(image_path)[1].lower()
        mime_type = "image/jpeg"
        if ext == ".png":
            mime_type = "image/png"
        elif ext == ".pdf":
            mime_type = "application/pdf"
            
        with open(image_path, "rb") as f:
            file_bytes = f.read()

        prompt = """
        Bạn là một chuyên gia nhận dạng dữ liệu biểu mẫu.
        Hãy đọc biểu mẫu yêu cầu thi công dán xe trong ảnh này và trích xuất các thông tin theo cấu trúc yêu cầu.
        Nếu thông tin nào bị mờ hoặc không có, hãy trả về rỗng hoặc 'Chưa đọc được'.
        Các vị trí dán phim (job_items) có thể bao gồm: Kính lái (WINDSHIELD), Kính lưng (REAR_WINDOW), Kính sườn trước (FRONT_SIDE), Kính sườn sau (REAR_SIDE), Kính khoang (REAR_SIDE_TRIANGLE), Cửa sổ trời (SUNROOF), Dán PPF.
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=OcrResult,
                temperature=0.1
            ),
        )

        text_response = response.text
        # LLM trả về JSON string
        result_json = json.loads(text_response)
        return result_json
        
    except Exception as e:
        print(f"Lỗi Gemini OCR: {str(e)}")
        return {"error": str(e)}
