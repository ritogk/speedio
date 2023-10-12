import time

class Logger:
    def __init__(self):
        self.first_time = time.time()
        
    def output_st(self, msg: str):
        print('[st]' + msg)
        self.start_time = time.time()
    
    def output_ed(self, msg: str):
        # 数値と文字列を結合して表示する
        print('  ' + str(time.time() - self.start_time))
        print('[ed]' + msg)
    
    def output_finish(self):
        print('[finish]')
        print('  ' + str(time.time() - self.first_time))