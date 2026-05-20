class Config:
    # Flask secret keys
    SECRET_KEY = "change-this-secret"
    JWT_SECRET_KEY = "change-this-jwt-secret"

    # Database
    SQLALCHEMY_DATABASE_URI = "sqlite:///app.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Google OAuth (Google Sign-In)
    GOOGLE_CLIENT_ID = "87402023434-i58iijg44st6qvnhftfirf796v8omem8.apps.googleusercontent.com"
