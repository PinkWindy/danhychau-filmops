import traceback
import sys
sys.path.append('web_demo')
from main import confirm_ocr
from database import SessionLocal

db = SessionLocal()
try:
    confirm_ocr('OCR-BBD485D8', {
        'dealer_name': 'LEXUS TRUNG TÂM SÀI GÒN',
        'customer_name': 'LÊ THANH PHƯƠNG',
        'vehicle_model': 'LX600 URBAN',
        'vin': 'JTJPB7CX304095170',
        'requested_delivery_time': '27/06/2026',
        'services': 'PPF, WINDOW_FILM',
        'request_no': '01.2600104',
        'request_date': '10/06/2026',
        'sequence_no': '80',
        'sales_consultant': 'NGUYỄN QUANG BẢO'
    }, db)
except Exception as e:
    traceback.print_exc()
