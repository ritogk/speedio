import time


class ExcutionTimer:
    def __init__(self):
        self.first_time = time.time()

    def start(self, msg: str):
        print("[st] " + msg)
        self.start_time = time.time()
        self.msg = msg

    def stop(self):
        # 数値と文字列を結合して表示する
        print("  " + str(round(time.time() - self.start_time, 4)) + " seconds")
        print("[ed] " + self.msg)

    def finish(self):
        print("[finish]")
        print("  " + str(time.time() - self.first_time))
