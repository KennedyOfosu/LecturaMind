"""
seed_marks.py — Populates student_marks with realistic grade data.
Run once: python seed_marks.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from services.supabase_client import supabase

# ── Course + lecturer IDs (from DB) ──────────────────────────────
NSA_COURSE_ID  = '023098e8-dead-4921-89a7-e27e4687c688'   # NSA 101
DC_COURSE_ID   = '4a98971c-adba-4887-80af-926dd499aab4'   # DC 201

# Fetch lecturer_id dynamically
def get_lecturer_id(course_id):
    r = supabase.table('courses').select('lecturer_id').eq('id', course_id).single().execute()
    return r.data['lecturer_id']

# ── Mark data ─────────────────────────────────────────────────────
# Format: { student_id: { assessment_type: score } }
# max_score = 100 for all entries

DC_MARKS = {
    # Armstrong Powers — struggling, at risk
    '376af2ea-7c38-4567-9667-6d27f1580d61': {
        'Quiz': 45, 'Assignment': 52, 'Mid-Sem': 38,
        'Presentation': 55, 'End-Sem 1': 42, 'End-Sem 2': 40,
    },
    # Abena Mensah Owusu — below average, watch
    '6e92cdda-dbb8-4793-b658-1b00374b6cd8': {
        'Quiz': 60, 'Assignment': 65, 'Mid-Sem': 55,
        'Presentation': 62, 'End-Sem 1': 58, 'End-Sem 2': 62,
    },
    # Yaw Boakye Asiedu — solid B, on track
    '66c95aad-1bd9-47d8-9c07-a865cc4feef0': {
        'Quiz': 72, 'Assignment': 75, 'Mid-Sem': 68,
        'Presentation': 78, 'End-Sem 1': 70, 'End-Sem 2': 74,
    },
    # Nana Ama Koomson — top performer, A
    'c8b955d3-6c16-411e-b6ed-f527640da7b0': {
        'Quiz': 88, 'Assignment': 85, 'Mid-Sem': 82,
        'Presentation': 90, 'End-Sem 1': 84, 'End-Sem 2': 86,
    },
    # Adwoa Poku Osei — C student, just on track
    '1f6a7929-7e38-4db4-b773-4de6dbb086b1': {
        'Quiz': 65, 'Assignment': 68, 'Mid-Sem': 62,
        'Presentation': 70, 'End-Sem 1': 64, 'End-Sem 2': 66,
    },
}

NSA_MARKS = {
    # Armstrong Powers — below average, watch
    '376af2ea-7c38-4567-9667-6d27f1580d61': {
        'Quiz': 50, 'Assignment': 55, 'Mid-Sem': 45,
        'Presentation': 58, 'End-Sem 1': 48, 'End-Sem 2': 50,
    },
    # Maame Esi Amoako — strong B, on track
    'd186c778-e135-45a5-870f-f0d3b4ff97d0': {
        'Quiz': 78, 'Assignment': 80, 'Mid-Sem': 75,
        'Presentation': 82, 'End-Sem 1': 76, 'End-Sem 2': 79,
    },
    # Kojo Wiredu Bonsu — C+, on track
    '02bc28e8-8350-4cfa-920a-1896571fc915': {
        'Quiz': 68, 'Assignment': 70, 'Mid-Sem': 65,
        'Presentation': 72, 'End-Sem 1': 66, 'End-Sem 2': 68,
    },
    # Kweku Barimah Mensah — B student, on track
    'e225d2c6-613f-437f-a949-d645c78020eb': {
        'Quiz': 75, 'Assignment': 78, 'Mid-Sem': 72,
        'Presentation': 80, 'End-Sem 1': 73, 'End-Sem 2': 76,
    },
    # Nii Armah Tackie — top of the class, A
    '29c02496-c79f-4098-b577-974e3569c3fd': {
        'Quiz': 90, 'Assignment': 88, 'Mid-Sem': 85,
        'Presentation': 92, 'End-Sem 1': 87, 'End-Sem 2': 89,
    },
    # Kofi Nimako Acheampong — watch, borderline
    '833cc2d8-b31b-412a-8f8e-281dbcf64fa1': {
        'Quiz': 58, 'Assignment': 62, 'Mid-Sem': 56,
        'Presentation': 65, 'End-Sem 1': 60, 'End-Sem 2': 62,
    },
    # Yaw Ofori Brenya — C, on track
    '4667f97a-31d5-4303-9784-d368442020ce': {
        'Quiz': 65, 'Assignment': 68, 'Mid-Sem': 63,
        'Presentation': 70, 'End-Sem 1': 64, 'End-Sem 2': 67,
    },
}

TITLE_MAP = {
    'Quiz':         'Quiz',
    'Assignment':   'Assignment 1',
    'Mid-Sem':      'Mid-Semester Exam',
    'Presentation': 'Group Presentation',
    'End-Sem 1':    'End of Semester Exam 1',
    'End-Sem 2':    'End of Semester Exam 2',
}

def clear_marks(course_id):
    supabase.table('student_marks').delete().eq('course_id', course_id).execute()
    print(f'  Cleared existing marks for course {course_id}')

def insert_marks(course_id, lecturer_id, marks_data):
    rows = []
    for student_id, assessments in marks_data.items():
        for assessment_type, score in assessments.items():
            rows.append({
                'student_id':      student_id,
                'course_id':       course_id,
                'lecturer_id':     lecturer_id,
                'assessment_type': assessment_type,
                'title':           TITLE_MAP[assessment_type],
                'score':           score,
                'max_score':       100,
                'source':          'manual',
            })
    supabase.table('student_marks').insert(rows).execute()
    print(f'  Inserted {len(rows)} marks ({len(marks_data)} students × {len(TITLE_MAP)} assessments)')

if __name__ == '__main__':
    print('\n── Seeding Data Communication II (DC 201) ──')
    dc_lecturer = get_lecturer_id(DC_COURSE_ID)
    clear_marks(DC_COURSE_ID)
    insert_marks(DC_COURSE_ID, dc_lecturer, DC_MARKS)

    print('\n── Seeding Networking & System Administration (NSA 101) ──')
    nsa_lecturer = get_lecturer_id(NSA_COURSE_ID)
    clear_marks(NSA_COURSE_ID)
    insert_marks(NSA_COURSE_ID, nsa_lecturer, NSA_MARKS)

    print('\nDone! Refresh the dashboard to see the data.\n')
