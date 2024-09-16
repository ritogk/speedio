import pandas as pd
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from db import get_db_session

def main():
    session = get_db_session()

    print("loading csv...")    
    csv_file_path = './data.csv'
    df = pd.read_csv(csv_file_path)
    print("loaded csv")

    # バッチサイズの設定
    batch_size = 10000
    batch = []

    insert_sql = """
    INSERT INTO buildings (geometry) 
    VALUES 
    {}
    """

    rowCnt = 0
    try:
        for index, row in df.iterrows():
            values = f"(ST_GeomFromText('{row['geometry']}', 4326))"
            batch.append(values)
            
            # バッチサイズに達したら挿入
            if len(batch) >= batch_size:
                session.execute(text(insert_sql.format(", ".join(batch))))
                session.commit()  # トランザクションをコミット
                batch = []
                rowCnt += batch_size
                print(rowCnt)

        # 残りのデータを挿入
        if batch:
            session.execute(text(insert_sql.format(", ".join(batch))))
            session.commit()
    except SQLAlchemyError as e:
        # エラーメッセージを表示
        print(f"An error occurred: {str(e)}")
        session.rollback()  # エラー時にはロールバックを行う
    finally:
        # セッションを閉じる
        session.close()
    return
main()
