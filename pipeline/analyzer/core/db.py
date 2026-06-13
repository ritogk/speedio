from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

def get_db_session():
    username = "postgres"
    password = "postgres"
    dbname = "speedia"
    host = "localhost"
    port = "5432"
    
    # データベースエンジンとセッションのセットアップ
    engine = create_engine(f"postgresql://{username}:{password}@{host}:{port}/{dbname}")
    Session = sessionmaker(bind=engine)
    
    return Session()