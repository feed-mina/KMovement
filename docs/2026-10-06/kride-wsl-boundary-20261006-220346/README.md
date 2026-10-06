# KMovement 격리 파일럿: OS 경계 준비 결과

검사 시점: 2026-10-06T13:01:18.742390+00:00 (UTC). 현재 단계는 **가짜 데이터·명령만 사용한 OS 경계 시험 통과**다. 실제 장소 검색 파일럿과 Chroma 색인은 시작하지 않았다.

## 선택과 준비

이 PC는 Windows Home(Core) build 26200이다. Windows Sandbox는 Home에서 지원되지 않는다. Docker Desktop은 이번 점검에서 엔진 시작에 실패했고, 기존 잠긴 소켓을 지우지 않았다. 그래서 D:의 별도 `Ubuntu-24.04` WSL2 가상 디스크(`D:\KMovement\.codex-work\kride-pilot-isolation-ubuntu-20261006\ext4.vhdx`)를 사용했다. 이는 Windows 프로그램을 그대로 실행하는 격리가 아니라 **Linux 가상 환경**이다.

첫 시작에서 `/etc/wsl.conf`를 설정하고 배포판을 종료·재시작했다. 첫 시작 순간의 WSL 기본 자동 마운트가 잠시 존재했을 수 있으나 그때는 모델·장소·파일럿을 실행하지 않았다. 재시작 후 설정과 실제 마운트 목록을 검사했다. 배포판 설정은 `automount.enabled=false`, `mountFsTab=false`, `interop.enabled=false`, `appendWindowsPath=false`다. `.wslconfig` 같은 전체 WSL 설정은 변경하지 않았다.

## 가짜 시험 결과

시험은 새 mount/network namespace에서 수행했다. `/mnt`, `/usr/lib/wsl`, X11 소켓 경로에 namespace 전용 빈 tmpfs를 덮고 WSL `/init`를 그 namespace에서 가렸다. 그 다음 전용 `kride-probe` 계정(uid 999)으로 권한을 내리고 모든 유효·bounding capability를 제거했으며 `no_new_privs=1`, 환경변수는 `HOME/LANG/PATH`만 남겼다. 이 변경은 시험 프로세스의 namespace에만 적용했다.

| 확인 항목 | 관찰 결과 | 의미 |
|---|---|---|
| 재시작 후 C/D DrvFs | 없음 | Windows 드라이브 자동 연결 없음 |
| 프로세스 mount 경계 | C/D 경로 없음, WSL 공유 브리지 경로 가림 | 시험 프로세스에서 호스트 경로로 접근 불가 |
| 별도 network namespace | 호스트 `net:[4026531840]`, 시험 `net:[4026532223]` | namespace 분리 확인 |
| 외부 연결 | 예비 주소 `192.0.2.1:443` 연결 결과 errno 101, 경로 0개 | 그 프로세스에는 외부 경로 없음; 실제 외부 전송 없음 |
| Linux 권한 | uid 999, CapEff/CapBnd 모두 0, NoNewPrivs 1 | 권한을 내려 시험 |
| 비밀 환경변수 | 허용한 3개 키만 존재 | 호스트 인증정보 환경 상속 없음 |
| 종료 | 배포판 종료 성공 | 시험 후 가동 상태를 남기지 않음 |

판정: `boundary-evidence.json`의 8개 조건이 모두 참이다. 이는 **이 시험 명령의 경계**에 한정한다. 배포판을 root로 일반 실행하면 이 네트워크 차단이 자동 적용되는 것은 아니다. 실제 파일럿의 시작 명령도 같은 namespace·권한 제거·경로 가림을 적용하고 다시 검사해야 한다. 원본·운영 경로에 접속해 부재를 시험하지 않았으며, 마운트 표와 합성 경로로만 판단했다.

## 실행과 분리한 조건

v2 `pilot-spec.json`은 수정하지 않았고 SHA256 `f2e47aa5ba6025203eaa860769d06bac09d0461d224e20120c629f696715fadd`이며 `executionAllowed=false`를 유지한다. v2의 33,164개 고정 파일은 **Windows x86_64 실행본**이므로 이 Ubuntu에서 실행할 수 있다는 증거가 아니다. Linux용 Python·native 패키지·모델 파일을 별도 위치에 확보해 전부 해시 고정한 다음, 해당 실행본이 이 경계 안에서 로드되는지를 파일럿 검색 없이 재검증해야 한다. 네트워크가 필요한 준비는 경계 밖 준비 단계로 기록하고, 실제 추론 프로세스에서는 네트워크를 끊어야 한다.

그 후에도 실제 1,000개 장소 검색은 **사용자의 별도 실행 승인**이 필요하다. 승인 전에는 장소 데이터 입력, 모델 추론, Chroma 생성/재색인, 전량 색인, 원본 복원, 운영 전환을 하지 않는다. 이번 점검에서 원본·운영 DB·서비스 코드·배포를 변경하지 않았다.

## 파일 및 근거

- `boundary-evidence.json`: 재시작 뒤 설정, namespace, mount, 권한, 네트워크의 기계 판정.
- `probe-boundary.py`: 시험에 사용한 그대로의 코드, SHA256 `f92ba8907b4f1436fc1af4ba7666213a801ce3c96e89aed414615e7c74ebce1e`.
- `boundary-verdict.json`: 준비 범위와 미완료 조건.
- WSL 가상 디스크는 계속 쓸 수 있는 상태이므로 크기만 기록했다. 쓰이는 VHD 파일을 완전한 스냅샷처럼 해시·복사하지 않았다.
- Microsoft Windows Sandbox: https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/
- Microsoft WSL 설정: https://learn.microsoft.com/en-us/windows/wsl/wsl-config
