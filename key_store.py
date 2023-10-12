import shelve

d = shelve.open('key_store')

def save(key, value):
    d[str(key)] = value
    d.sync()
    
def load(key):
    #　存在するかチェック
    if str(key) not in d:
        return None
    return d[str(key)]