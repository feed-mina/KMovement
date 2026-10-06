# 기존 KVM 4 제한 컨테이너 준비 결과

사용자가 기존 KVM 4의 제한된 컨테이너 방식을 선택하여 그 범위에서 준비했다. 현재 단계는 준비·합성 경계 검사·모델 로드 완료이며 executionAllowed=false이다. 임베딩 계산, Chroma client/색인 생성, 1,000개 검색, 120문항 평가는 하지 않았다.

## 실제 준비 결과

호스트는 Ubuntu 24.04.5, 4 CPU, Docker 29.8.2, cgroup v2다. 시작 시 가용 메모리 10.83 GiB, 디스크 83.24 GiB를 읽었다. 자원은 시점 관찰값이며 장기 부하 보장이 아니다. 새 경로는 /opt/kride-pilot-prep/20261006-223827이다. 운영 서비스의 설정·볼륨·인증정보를 컨테이너에 연결하지 않았다.

Python 3.11.15 공식 Linux 이미지의 digest는 python@sha256:d29f48a31a8b408ed19272ca1e7b10ebae13b240a27e862d3d4217c528e2e0c3이다. 호스트 Ubuntu를 재설치하지 않았으며 실행 컨테이너의 기반 배포판은 Python slim-bookworm(Debian)이다. Linux 주요 버전은 {"torch": "2.14.1+cpu", "numpy": "2.4.6", "chromadb": "1.5.9", "transformers": "5.18.0", "sentence-transformers": "6.1.0", "tokenizers": "0.23.2"}이며 기존 Windows 주요 버전과 일치한다. 전이 의존성은 Linux용으로 해결해 별도로 고정했다.

97개 설치 배포 패키지, 모델, wheel 등 총 27,466개 파일 / 2,152,543,057바이트에 SHA256을 기록했다. 전체 wheel과 전이 의존성을 보관하고 --no-index --require-hashes로 설치했다. 런타임 파일 복사 전후 전체 해시가 일치한다. 기본 OS·Python은 OCI digest와 image archive로 고정하고, OS 패키지 버전과 실제 로드된 native 파일 212개의 SHA256도 기록했다. 커널과 Docker는 공유 호스트 버전을 기록한 것이며 전체 운영 호스트를 불변 복제했다는 뜻은 아니다.

모델 10개 파일은 기존 multilingual-e5-small revision 614241f622f53c4eeff9890bdc4f31cfecc418b3 및 기존 모델 SHA256과 모두 일치했다. 후보1,000개·검수 질문120개 등 허용한 입력5개만 전달하고 전송 전후 해시를 대조했다. 기존 v2 명세 SHA256은 f2e47aa5ba6025203eaa860769d06bac09d0461d224e20120c629f696715fadd로 유지된다. 옛 Chroma DB나 전체 원본 저장소는 전달하지 않았다.

## OS 제한과 실제 검사

최종 검증 컨테이너는 CPU 1개, 메모리4 GiB, swap0, PID128, network none, 공개 포트 없음, uid/gid65532, capabilities 전부 제거, no-new-privileges, seccomp 적용, 읽기 전용 rootfs로 실행했다. PID·IPC는 host 모드를 쓰지 않고 cgroup namespace는 private이다. 운영 호스트의 Docker socket도 연결하지 않았다.

runtime/model/inputs/checks/policy 5개 전용 경로만 읽기 전용으로 마운트했다. 쓰기 공간은 메모리 기반 output256 MiB와 tmp128 MiB이며 합산 메모리 제한 안에 포함된다. 출력은 컨테이너 종료 시 사라지므로 향후 승인된 검색 결과는 종료 전에 별도로 반출·검증하는 실행 절차가 필요하다. 로그는5 MiB·1파일 제한이다.

실제 비권한 프로세스에서 입력/모델/rootfs 쓰기 실패, 허용 출력 쓰기 성공, uid0 전환 실패, IPv4/IPv6 TCP/UDP 외부 연결 실패, DNS 실패, cgroup 제한값을 확인했다. 네트워크 시험은 문서용 예약 주소와 합성 이름을 사용했으며 운영 DB 접속을 시도하지 않았다. HostConfig/마운트 허용 목록도 시작 전에 별도로 검사했다. 내부 검사 13개가 모두 참이다. DNS 타임아웃도 실패로 취급하는 검사이므로 DNS 하나만으로 외부 차단을 판정하지 않았고 network none·프로토콜별 오류 증거를 함께 사용했다.

pip check는 No broken requirements found. 결과다. CPU에서 tokenizer와 모델을 local_files_only로 로드했고 hidden size384를 확인했다. 모델 forward, encode, 검색은 호출하지 않았다. 로드 검사 기록의 peak RSS 868.8 MiB와 시간 21.58초는 모델 로드와 검사 수치이며 첫 검색 응답 시간이나 전체 검색 품질이 아니다.

## 보존과 종료

runtime-package.tar.gz, base-image.tar.gz, review-bundle.tar.gz를 만들고 서버와 D:의 별도 보관 폴더에서 SHA256을 대조했다. 로컬 경로는 D:\KMovement\.codex-work\kvm4-container-archive-20261006-223827다. archive-lock.json에 크기와 해시가 있다. 준비/검증 컨테이너는 종료했고 자동 재시작은 no다. 새 검색용 서비스·cron·부팅 작업은 설치하지 않았다. 운영 VPS 전체 스냅샷이나 복원을 하지 않았고 준비 실행본만 보존했다.

운영 컨테이너 19개의 ID·시작 시각·재시작 횟수·상태·health를 준비 전후 비교한 결과 동일=True이다. 이는 로그인 UI나 운영 API의 기능별 회귀 검사를 대신하지 않는다. 공유 호스트의 CPU·디스크 I/O·커널 경합 가능성은 남는다. 따라서 별도 VPS 수준의 분리라고 표현하지 않는다.

## 준비 중 복구한 문제

Docker local 로그 설정은 압축을 끈 1파일 제한으로 수정했다. 처음 pip 다운로드는128 MiB /tmp 제한에 걸려3 GiB /work 내 임시 경로로 옮겼다. 첫 tmpfs 보존 시 docker cp가 빈 디렉터리만 반환해 해시 검증에서 중단됐다. 종료된 첫 준비 컨테이너의 임시 자료는 보존되지 않았고, 새 준비 컨테이너에서 동일 버전·모델을 다시 받아 컨테이너 안의 tar 스트림으로 보존했다. 최종 압축본의 추출 파일 전체 및 로컬 보관본 해시 검증은 통과했다. 원본 데이터나 운영 DB 복구를 수행한 것은 아니다.

## 다음 승인 대상

현재 executionAllowed=false이며 이 작업의 승인은 준비까지만이다. 실제 파일럿은 이번 image/archive/input manifest, 전용 출력 경로, 후보1,000개·질문120개, 시간·자원 한도를 특정한 별도 승인 후 시작한다. 실행 전 호스트 여유 자원과 해시·컨테이너 제한을 다시 확인하고 검색 전용 runner를 검토해야 한다. runner는 현재 설치하지 않았으므로 검증 컨테이너를 시작해도 검색은 수행되지 않는다.

평가에서 A/B는 저장 벡터를 고정하고 질문 접두사만 바꾼다. C 문서 형식 비교는 별도다. 한국어/영어/일본어 지표·근거없음·ANN·시간/자원은 각각 판정한다. 기존 v2의 publicEligibleCount=0과 출처 URL·좌표·지역·예산·아티스트 증거 계약은 검색 수치와 별개다. 전량 재색인·운영 전환은 승인 범위에 없다.

Docker 공식 근거: https://docs.docker.com/engine/containers/resource_constraints/ , https://docs.docker.com/engine/network/drivers/none/
