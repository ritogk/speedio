import numpy as np
import matplotlib.pyplot as plt
from pyproj import Transformer

# 座標のリスト
coords = [(137.408164, 34.9574209), (137.4082532, 34.9573408), (137.4084537, 34.9571953), (137.4086585, 34.9570569), (137.4090649, 34.9568022), (137.4091974, 34.9567083), (137.4093101, 34.9564171), (137.4093686, 34.9561915), (137.4094912, 34.9557748), (137.4095738, 34.9554163), (137.4095492, 34.9551948), (137.4094668, 34.9550296), (137.409366, 34.9548795), (137.4091905, 34.9547602), (137.407761, 34.9539961), (137.4075841, 34.9538545), (137.4074709, 34.9536838), (137.4073219, 34.9532157), (137.407132, 34.9523181), (137.4071515, 34.9518777), (137.4072609, 34.9512656), (137.4072777, 34.9511605), (137.4074275, 34.9505775), (137.4076999, 34.9500671), (137.4077388, 34.9498119), (137.407661, 34.9495659), (137.4072941, 34.9491284), (137.4069216, 34.9489097), (137.4062823, 34.9487047), (137.4060655, 34.9484814), (137.4060432, 34.9482217), (137.4061489, 34.9479528), (137.4064102, 34.9475883), (137.4064991, 34.9473194), (137.4065325, 34.9469686), (137.4065936, 34.9466951), (137.4068549, 34.9465265), (137.4075109, 34.9461848), (137.4080279, 34.9459433), (137.4084115, 34.9459023), (137.4089007, 34.9459478), (137.409351, 34.9459888), (137.4095063, 34.9459921), (137.4096679, 34.9459934), (137.4099013, 34.9459524), (137.4100236, 34.9458293), (137.410107, 34.9456152), (137.4105206, 34.9445642), (137.4107554, 34.9443407), (137.4110707, 34.9441268), (137.4112084, 34.9440507), (137.4118415, 34.9437423), (137.4127199, 34.9433276), (137.4131201, 34.9430542), (137.4134426, 34.9426577), (137.4134592, 34.942439), (137.4133703, 34.9422248), (137.4129534, 34.9417736), (137.4128533, 34.941441), (137.4129422, 34.940648), (137.4129033, 34.9404338), (137.4126309, 34.94001), (137.412592, 34.9397958), (137.4126532, 34.939527), (137.4126476, 34.9393538), (137.4125142, 34.9391988), (137.4123363, 34.9391487), (137.4120639, 34.9392125), (137.4113412, 34.9393857), (137.4109687, 34.9393675), (137.4105184, 34.9391806), (137.4102015, 34.938971), (137.4097624, 34.938497), (137.4097401, 34.9382509), (137.4098402, 34.9380504), (137.4102405, 34.9376539), (137.4103675, 34.9374162), (137.4103961, 34.9371298), (137.4103961, 34.9369202), (137.4103238, 34.9361682), (137.4103342, 34.9356574), (137.4103794, 34.9352157), (137.4105518, 34.934245), (137.4105962, 34.9340353), (137.4108019, 34.9337619), (137.4111299, 34.9336024), (137.411723, 34.933163), (137.41198, 34.9329665), (137.4122904, 34.9327527), (137.4124864, 34.9324903), (137.412542, 34.9320619), (137.4125976, 34.9317019), (137.4124864, 34.9312826), (137.4122188, 34.9307099), (137.4119882, 34.9304144), (137.4114579, 34.9299563), (137.4110743, 34.9296874), (137.4106518, 34.9291951), (137.4101126, 34.9284887), (137.4100626, 34.9282836), (137.4101571, 34.9280602), (137.4104461, 34.9276956), (137.4106018, 34.9275771), (137.4106852, 34.9274221), (137.4111021, 34.9263829), (137.4112578, 34.9262599), (137.4114635, 34.9261094), (137.4117303, 34.9260639), (137.4120194, 34.9260775), (137.4121973, 34.9261231), (137.4124308, 34.9260867), (137.4130479, 34.9258815), (137.4135093, 34.9256217), (137.4137094, 34.9253893), (137.4138095, 34.9249608), (137.4139151, 34.9247967), (137.4140474, 34.9246414), (137.4141926, 34.9245883), (137.4145013, 34.9245521), (137.415222, 34.9244759), (137.4158168, 34.9242435), (137.4165117, 34.923774), (137.4166489, 34.9236352), (137.416738, 34.923434), (137.4169051, 34.9231059), (137.4169339, 34.9227141), (137.4168906, 34.9222392), (137.4165673, 34.9212807), (137.4164673, 34.92103), (137.4165006, 34.9208841), (137.4166896, 34.9208385), (137.4170843, 34.9208157), (137.4172789, 34.9207656), (137.417429, 34.9206197), (137.4177737, 34.9196078), (137.4177459, 34.919471), (137.4174456, 34.9192282), (137.4172971, 34.9190509), (137.4172547, 34.9189297), (137.4172585, 34.9186652), (137.4173456, 34.9184636), (137.4176291, 34.9178483), (137.4177582, 34.9177025), (137.4178626, 34.9176295), (137.4181628, 34.9175383), (137.4186038, 34.9174426), (137.4188409, 34.9173669), (137.4189871, 34.9172501), (137.4190279, 34.9170447), (137.4188932, 34.9168956), (137.4185917, 34.916815), (137.4183676, 34.9167103), (137.4182277, 34.9165993), (137.4180944, 34.9163722), (137.4179524, 34.9158894), (137.4178762, 34.9156438), (137.4178762, 34.9155134), (137.4179077, 34.9154336), (137.4179524, 34.9153679), (137.4181128, 34.915286), (137.4182941, 34.915244), (137.4185635, 34.9152073), (137.4188671, 34.9151632), (137.4193349, 34.9151588), (137.4198014, 34.9152504), (137.4199906, 34.915272), (137.4200918, 34.9152558), (137.4201812, 34.9152213), (137.4202587, 34.9151599), (137.4203087, 34.9150823), (137.4203218, 34.9149326), (137.4203165, 34.9147731), (137.4202666, 34.9145586), (137.4202009, 34.9143399), (137.4200695, 34.9140522), (137.4199381, 34.9138054), (137.4198855, 34.9136373), (137.4198881, 34.9134821), (137.4199552, 34.9133075), (137.4200918, 34.9129983), (137.4202154, 34.9127407), (137.4205478, 34.9120704), (137.4207134, 34.9117116), (137.4207397, 34.9115542), (137.4207397, 34.9114066), (137.4206898, 34.9112924), (137.4205965, 34.9111749), (137.4204112, 34.9109788), (137.420193, 34.9108215), (137.4200287, 34.9107363), (137.4198921, 34.9106986), (137.4197331, 34.9106921), (137.4194545, 34.9107417), (137.4192337, 34.9108107), (137.4190708, 34.9108258), (137.4189643, 34.9108171), (137.4189091, 34.9107902), (137.4188631, 34.9107428), (137.4188316, 34.9106727), (137.4188316, 34.9106189), (137.4188526, 34.9105564), (137.4189209, 34.9104777), (137.4190918, 34.9103398), (137.4192298, 34.9102234), (137.4193309, 34.9101253), (137.4193967, 34.9100391), (137.4194045, 34.9099535), (137.4194101, 34.9098133), (137.4193878, 34.9096693), (137.4193264, 34.9094925), (137.4192716, 34.9092814), (137.4192958, 34.9091785), (137.4193367, 34.9090924), (137.4193757, 34.909049), (137.4195067, 34.9089431), (137.4197465, 34.9088379), (137.4200401, 34.9087091), (137.4201776, 34.9086626), (137.4203179, 34.9086535), (137.4205186, 34.9086924), (137.4207528, 34.9087487), (137.4209173, 34.9087952), (137.4211301, 34.9088394), (137.4212797, 34.9088371), (137.421486, 34.9088166), (137.4217201, 34.908764), (137.4222159, 34.9086382), (137.4226155, 34.9085422), (137.4232232, 34.9084187), (137.4237268, 34.9083791), (137.4240929, 34.9083668), (137.4245844, 34.9083862), (137.4250088, 34.9084272), (137.425361, 34.9084897), (137.4258052, 34.9085921), (137.4261455, 34.9086686), (137.4264373, 34.9087225), (137.4266396, 34.9087257), (137.4267605, 34.9087149), (137.4269708, 34.9086729), (137.4276936, 34.9085231), (137.4278618, 34.9085069), (137.4279932, 34.9085231), (137.4280826, 34.9085597), (137.4281496, 34.9086212), (137.4282048, 34.9087149), (137.4282311, 34.9088561), (137.4282495, 34.9092559), (137.4282468, 34.909479), (137.4282153, 34.9096568), (137.4281364, 34.9097818), (137.4280458, 34.9098788), (137.4279603, 34.9099327), (137.4277461, 34.9100221), (137.4274518, 34.9100976), (137.4272323, 34.9101665), (137.4271443, 34.9102269), (137.427093, 34.9102915), (137.4270733, 34.9103896), (137.4271364, 34.9104877), (137.4272257, 34.9105426), (137.4273624, 34.9105674), (137.4275622, 34.9105416), (137.4278644, 34.9104963), (137.4280747, 34.9104165), (137.4281877, 34.9103422), (137.4284058, 34.9101364), (137.4285911, 34.9099812), (137.4288855, 34.9097322), (137.4290563, 34.9096471), (137.4291746, 34.9096309), (137.4293113, 34.9096525), (137.4294138, 34.9097042), (137.429624, 34.9098271), (137.4302167, 34.9101655), (137.4305176, 34.9103045), (137.4308672, 34.91045), (137.4314126, 34.9106235), (137.4322904, 34.9108972), (137.4330158, 34.9111073), (137.4338213, 34.9113627), (137.4343186, 34.9115586), (137.4347334, 34.9118527), (137.4351657, 34.9121129), (137.4355095, 34.9123613), (137.435805, 34.9125793), (137.4359834, 34.9127149), (137.4360522, 34.9128018), (137.4360847, 34.9128898), (137.4361136, 34.9130255), (137.4361333, 34.9132432), (137.4361806, 34.9133876), (137.4362503, 34.9134652), (137.4364014, 34.9135374), (137.4365538, 34.913546), (137.4366747, 34.9135449), (137.436797, 34.9135309), (137.4371452, 34.913476), (137.4373357, 34.9134868), (137.4375132, 34.9135234), (137.4377221, 34.9136021), (137.4378772, 34.9136926), (137.4379586, 34.9138014), (137.437971, 34.913905), (137.4379639, 34.9139781), (137.4379218, 34.9140708), (137.4378049, 34.9141937), (137.437684, 34.9142874), (137.4375959, 34.914379), (137.4375539, 34.9144577), (137.4375053, 34.9145644), (137.4375079, 34.9146646), (137.4375145, 34.9147809), (137.4375867, 34.9148779), (137.4376787, 34.9149685), (137.4378417, 34.9151021), (137.4384449, 34.9155805), (137.4388457, 34.9159038), (137.439073, 34.9160309), (137.4395269, 34.9162128), (137.4397069, 34.9163012), (137.4397884, 34.9163507), (137.439885, 34.9164391), (137.4399566, 34.9165388), (137.4400339, 34.9166985), (137.4403084, 34.9173286), (137.4403916, 34.9174297), (137.4404885, 34.9175), (137.4405844, 34.9175197), (137.4406938, 34.9175097), (137.440802, 34.9174557), (137.4408719, 34.917366), (137.4408796, 34.917244), (137.4408241, 34.9171113), (137.4406056, 34.9167062), (137.4405366, 34.9165663), (137.4404868, 34.9164118), (137.4404979, 34.9162685), (137.4405239, 34.9161725), (137.4405834, 34.916075), (137.4407135, 34.9159729), (137.4408752, 34.9158845), (137.4411649, 34.9157688), (137.4416205, 34.9155875), (137.4417952, 34.9155412), (137.4419365, 34.9155471), (137.4420502, 34.9155719), (137.4421671, 34.9156479), (137.4422414, 34.915753), (137.4422604, 34.9158591), (137.4422302, 34.9159933), (137.4421178, 34.9160999), (137.4419766, 34.9161576), (137.4418176, 34.9161543), (137.4417136, 34.9161203), (137.4416207, 34.9160695), (137.4415463, 34.9159933), (137.4414866, 34.9158731), (137.4413342, 34.9153947), (137.4412923, 34.9152413), (137.4413174, 34.9151037), (137.4413631, 34.9150208), (137.4414419, 34.9149491), (137.4415444, 34.9148958), (137.4416791, 34.9148759), (137.4418224, 34.9148796), (137.4419446, 34.9149297), (137.4420918, 34.9150316), (137.4426187, 34.9154842), (137.4427764, 34.9156145), (137.442896, 34.9156684), (137.442988, 34.91569), (137.4431089, 34.9156846), (137.443239, 34.9156458), (137.4433428, 34.9155887), (137.4435202, 34.915482), (137.4436503, 34.9154314), (137.4437975, 34.9154109), (137.4439486, 34.915427), (137.4441103, 34.9154712), (137.4444072, 34.9155811), (137.4449199, 34.915757), (137.4450723, 34.9158363), (137.4451629, 34.9159141), (137.4452627, 34.9160477), (137.4453008, 34.9161596), (137.4453458, 34.9166541), (137.44537, 34.9167972), (137.4454396, 34.9169349), (137.4455666, 34.9170803), (137.4458507, 34.9173309), (137.4460599, 34.917539), (137.4461424, 34.9176604), (137.4461907, 34.9177979), (137.4461902, 34.9179065), (137.4461605, 34.9180485), (137.4460543, 34.9183436), (137.4460171, 34.9184905), (137.4460187, 34.9185967), (137.4460579, 34.9186578), (137.4461638, 34.9187039), (137.4463055, 34.918705), (137.4464669, 34.9186763), (137.4467741, 34.9186289)]

def generate_xy_coords(coords: list):
    # MEMO: 東京の平面直角座標のEPSGだが本当によいのか？値はそれっぽいが。
    # https://lemulus.me/column/epsg-list-gis
    transformer = Transformer.from_crs(4326, 6677)
    trans_coords = transformer.itransform(coords, switch=True)
    return np.array(list(trans_coords))

# 緯度経度をメートルに変換
points_m = generate_xy_coords(coords)


# 車のパラメータ
wheelbase = 2.5  # 一般的な車のホイールベース（メートル）
steering_ratio = 15  # 一般的なステアリングギア比

# 3点を通る円の中心の座標と半径を計算
def calc_circle_center_and_radius(p1, p2, p3):
    # chatgptに作ってもらいました。
    temp = p2[0]**2 + p2[1]**2
    bc = (p1[0]**2 + p1[1]**2 - temp) / 2
    cd = (temp - p3[0]**2 - p3[1]**2) / 2
    det = (p1[0] - p2[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p2[1])

    if abs(det) < 1.0e-10:
        raise ValueError("Points are collinear")

    # 円の中心 (cx, cy)
    cx = (bc * (p2[1] - p3[1]) - cd * (p1[1] - p2[1])) / det
    cy = ((p1[0] - p2[0]) * cd - (p2[0] - p3[0]) * bc) / det

    # 半径
    radius = np.sqrt((cx - p1[0])**2 + (cy - p1[1])**2)

    return (cx, cy), radius

# ステアリング切れ角を計算
def steering_angle(wheelbase, radius, steering_ratio):
    tire_angle = np.arctan(wheelbase / radius) * (180 / np.pi)  # タイヤの回転角度を度に変換
    steering_wheel_angle = tire_angle * steering_ratio  # ステアリングホイールの回転角度
    return steering_wheel_angle

# 結果を保持するリスト
angles_info = []

# 3つのポイントずつ処理してステアリングホイールの回転角度を計算
for i in range(1, len(points_m) - 1):
    p1 = points_m[i - 1]
    p2 = points_m[i]
    p3 = points_m[i + 1]
    center, radius = calc_circle_center_and_radius(p1, p2, p3)
    angle = steering_angle(wheelbase, radius, steering_ratio)
    angles_info.append((i, coords[i], angle))

# 結果を出力
for i, coord, angle in angles_info:
    print(f"座標 {coord} でのステアリングホイールの回転角度: {angle:.2f} 度")

# プロット
plt.figure(figsize=(10, 10))
plt.plot(points_m[:, 0], points_m[:, 1], 'b-', label='Path')
# plt.plot(points_m[:, 0], points_m[:, 1], 'ro', label='points',markersize=2, color='darkgray')

# ターンポイントをプロット
for i, coord, angle in angles_info:
    if angle < 22:
        continue
    # 高速コーナー
    if 22 <= angle < 45:
        color = "green"
        size = 4
    # 中速コーナー
    elif 45 <= angle < 80:
        color="darkorange"
        size=8
    # 低速コーナー
    else:
        print(angle)
        color="red"
        if angle <= 100:
            size = 12
        elif angle <= 145:
            size = 14
        else:
            size = 20
    # color="red"
    plt.plot(points_m[i, 0], points_m[i, 1], 'go', markersize=size, color=color, alpha=0.2)
        # if angle >= 45:
        #     plt.text(points_m[i, 0], points_m[i, 1], f"{angle:.2f}°", fontsize=7, ha='right')

plt.xlabel('Meters (X)')
plt.ylabel('Meters (Y)')
plt.legend()
plt.title('Turning Points with Steering Wheel Angles')
plt.grid(True)
plt.gca().set_aspect('equal', adjustable='box')
plt.show()