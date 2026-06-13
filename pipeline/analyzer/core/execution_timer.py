import time

from enum import Enum


class ExecutionType(Enum):
    FETCH = 1
    PROC = 2


class ExecutionTimer:
    fetch_time = 0
    execution_time = 0
    execution_type = ExecutionType.PROC

    def __init__(self):
        self.first_time = time.time()

    def start(self, msg: str, execution_type: ExecutionType = ExecutionType.PROC):
        print("[st] " + msg)
        self.start_time = time.time()
        self.msg = msg
        self.execution_type = execution_type

    def stop(self):
        # 数値と文字列を結合して表示する
        execution_time = round(time.time() - self.start_time, 4)
        print("  ⏰ " + str(execution_time) + " seconds")
        print("[ed] " + self.msg)
        if self.execution_type == ExecutionType.FETCH:
            self.fetch_time += execution_time
        else:
            self.execution_time += execution_time

    def finish(self):
        print("[finish] 🎉")
        print("  ⏰ total: " + str(round(time.time() - self.first_time, 4)) + " seconds")
        print("  🛠️ proc : " + str(round(self.execution_time, 4)) + " seconds")
        print("  📦 fetch: " + str(round(self.fetch_time, 4)) + " seconds")
