from shapely.geometry import Point, LineString
from road_width_calculator import RoadWidthCalculator

road_width_calculator = RoadWidthCalculator('center', 'rdedg')
# st_p = Point(34.6958752,132.9045786)
# ed_p = Point(34.6952861,132.9054915)
st_p = Point(35.6938077, 139.7628514)
ed_p = Point(35.6937878, 139.7629656)


width = road_width_calculator.calculate(st_p, ed_p)
print(f"width: {width}")