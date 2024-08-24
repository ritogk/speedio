import time

from enum import Enum


class ExcutionType(Enum):
    FETCH = 1
    PROC = 2


class ExcutionTimer:
    fetch_time = 0
    excution_time = 0
    excution_type = ExcutionType.PROC

    def __init__(self):
        self.first_time = time.time()

    def start(self, msg: str, excution_type: ExcutionType = ExcutionType.PROC):
        print("[st] " + msg)
        self.start_time = time.time()
        self.msg = msg
        self.excution_type = excution_type

    def stop(self):
        # 数値と文字列を結合して表示する
        excution_time = round(time.time() - self.start_time, 4)
        print("  ⏰ " + str(excution_time) + " seconds")
        print("[ed] " + self.msg)
        if self.excution_type == ExcutionType.FETCH:
            self.fetch_time += excution_time
        else:
            self.excution_time += excution_time

    def finish(self):
        print("[finish] 🎉")
        print("  ⏰ total: " + str(round(time.time() - self.first_time, 4)) + " seconds")
        print("  🛠️ proc : " + str(round(self.excution_time, 4)) + " seconds")
        print("  📦 fetch: " + str(round(self.fetch_time, 4)) + " seconds")
