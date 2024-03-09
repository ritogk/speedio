from dotenv import load_dotenv
import os


load_dotenv()


def getEnv():
    POINT_ST = os.getenv("POINT_ST")
    POINT_ED = os.getenv("POINT_ED")
    return {
        "POINT_ST": POINT_ST.replace(" ", "").split(","),
        "POINT_ED": POINT_ED.replace(" ", "").split(","),
    }
