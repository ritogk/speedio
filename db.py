from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

usename = "postgres"
password = "postgres"
dbname = "speedia"
host="localhost"
port="5432"
engine = create_engine(f"postgresql://{usename}:{password}@{host}:{port}/{dbname}")

# Sessionクラスを作成
Session = sessionmaker(bind=engine)

# Sessionインスタンスを作成し、データベース操作を行う
with Session() as session:
    # SQLクエリを実行
    result = session.execute(text("SELECT * FROM locations;"))
    # 結果を表示
    for row in result:
        print(row)