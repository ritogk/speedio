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

print('start')
def get_location():
    # Sessionインスタンスを作成し、データベース操作を行う
    with Session() as session:
        # SQLクエリを実行
        result = session.execute(text("SELECT * FROM locations;"))
        return result
locations = get_location()
# 結果を表示
for row in locations:
    print(row)
print('end')