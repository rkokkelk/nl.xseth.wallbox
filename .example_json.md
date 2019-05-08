{"version":"B","rbc":"251","rbt":"2208867","car":"1","amp":"10","err":"0","ast"
:"0","alw":"1","stp":"0","cbl":"0","pha":"8","tmp":"30","dws":"0","dwo":"0","ad
i":"1","uby":"0","eto":"120","wst":"3","nrg":[2,0,0,235,0,0,0,0,0,0,0,0,0,0,0,0
],"fwv":"020-rc1","sse":"000000","wss":"goe","wke":"","wen":"1","tof":"101","td
s":"1","lbr":"255","aho":"2","afi":"8","ama":"32","al1":"11","al2":"12","al3":"
15","al4":"24","al5":"31","cid":"255","cch":"65535","cfi":"65280","lse":"0","us
t":"0","wak":"","r1x":"2","dto":"0","nmo":"0","eca":"0","ecr":"0","ecd":"0","ec
4":"0","ec5":"0","ec6":"0","ec7":"0","ec8":"0","ec9":"0","ec1":"0","rca":"","rc
r":"","rcd":"","rc4":"","rc5":"","rc6":"","rc7":"","rc8":"","rc9":"","rc1":"","
rna":"","rnm":"","rne":"","rn4":"","rn5":"","rn6":"","rn7":"","rn8":"","rn9":""
,"rn1":""}

<!--

car = status of car; 1 = Charger ready, no car, 2 = Car charging, 3 = Waiting for car, 4 = Finished charging, car still connected
amp = Ampere setting
err = Error; 0 = no error, any other value = error
===========================================================
sse = DEVICE_ID
car = 1,4 = OFF; 2,3 = ON
alw = ("onoff")
ast = 0 = UNLOCKED; 1 = LOCKED ("locked")
nrg[11] = POWER ("measure_power")/100 = kWh
nrg[7+8+9] = CURRENT ("measure_current")/10 = A
nrg[0+1+2] = VOLTAGE ("measure_voltage")
tmp = TEMPERATURE ("measure_temperature")
dws = POWER METER PER session ("meter_power") * 0,00000277‬ = kWh
===========================================================
//-->
