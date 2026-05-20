from database import db

class Appointment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    doctor = db.Column(db.String(120))
    user_id = db.Column(db.Integer)
