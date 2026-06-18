import os
from daytona import Daytona, CreateSandboxFromImageParams
d = Daytona()
s = d.create(CreateSandboxFromImageParams(name="test-sandbox", image="ubuntu:22.04"))
print(dir(s.process))
print(s.process.exec("echo 'hello'").result)
d.delete(s)
