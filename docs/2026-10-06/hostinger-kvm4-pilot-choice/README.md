# Hostinger 파일럿 전용 VPS 준비 명세

작성: 20261006-222942 Asia/Seoul. 현재는 로컬 준비 명세 완료, 전달받은 VPS는 운영 서버와 일치하여 대상에서 제외, 원격 설치·구매·검색 미실행이다. WSL 증거와 v2 원본은 보존한다. executionAllowed=false.

## 실제 확인한 대상 충돌

사용자가 별도 VPS로 전달한 root@187.127.214.171은 현재 kmovement.srv1869569.hstgr.cloud의 A 레코드와 일치한다. 저장소 deploy/hostinger/VPS-DEPLOY-RUNBOOK-KO.md:13에도 같은 운영 대상이 명시돼 있다. 따라서 이 주소는 파일럿 대상에 바인딩하지 않았다. SSH로 접속하지 않았고 설치·재설치·방화벽·스냅샷 변경도 하지 않았다. 다른 서버 정보 또는 신규 전용 VPS 준비 여부가 필요하다. 이 중단은 자동 승인 거절이 아니라 사용자가 정한 운영 완전 미연결 조건에 따른 것이다.

## KVM 4인데 별도 VPS가 필요한가?

새 VPS가 기술적으로 반드시 필요한 것은 아니다. KVM 4는 자원 사양이고 별도 VPS는 운영과 실험을 분리하는 배치 방식이다. 사용자는 현재 서버가 KVM 4라고 알려주었다. 실제 남은 메모리·CPU 부하·디스크 여유·Docker/cgroup 지원은 아직 측정하지 않았다.

| 선택 | 추가 VPS 비용 | 분리 범위 | 현재 판정 |
|---|---|---|---|
| 전용 VPS | 새 서버가 없으면 발생 | 운영 VPS와 별도 게스트 OS·디스크·자원 할당 | 앞서 요청한 별도 VPS 조건에 맞음; 동일 물리 서버 여부까지 보장하는 뜻은 아님 |
| 기존 KVM 4의 제한된 컨테이너 | 기존 요금 외 추가 VPS 구매 불필요 | 계정·파일·네트워크·자원을 제한하지만 운영과 호스트 커널·디스크·자원 공유 | 조건 변경과 용량 점검 필요; 아직 준비 승인으로 보지 않음 |

기존 서버 방식은 운영 볼륨·인증정보·Docker socket 미연결, privileged/host network 금지, 전용 입력/출력, read-only rootfs, capability 제거, 비권한 실행, 네트워크 none, CPU·메모리·PID·출력 디스크/로그·실행시간 제한을 설계한 뒤 검증한다. 수치 제한은 실제 여유 자원과 운영 여유분을 확인한 후 결정한다. 디스크·I/O 경합과 공유 커널 위험이 남으므로 별도 VPS와 동등한 분리라고 하지 않는다. 기존 운영 VPS의 재설치·전역 방화벽 변경·Docker 재시작·스냅샷 복구는 이 대안의 승인에 포함하지 않는다.

비용을 줄이고 싶으면 다음 단계로 기존 서버의 읽기 전용 자원 점검을 선택할 수 있다. 현재의 별도 서버 조건을 그대로 유지하려면 전용 VPS를 선택한다. 어느 쪽이든 준비 후 executionAllowed=false에서 멈추고 실제 검색은 별도 승인이다. 현재 질문은 조건 변경이나 구매·운영 변경 승인으로 해석하지 않았다.

기술 출처: https://docs.docker.com/engine/containers/resource_constraints/ 및 https://docs.docker.com/engine/network/drivers/none/

## 판단과 사용자 역할

별도 Hostinger VPS는 Windows 실행본을 Linux 환경으로 옮겨 검증하려는 목적에 맞는 후보다. KVM 2의 공식 안내는 2 vCPU / 8 GB RAM / 100 GB NVMe이다. 1,000개 CPU 검색 파일럿의 시작 후보로 판단하지만 실제 속도·메모리 통과 결과는 아니다. GPU는 이번 준비 요구에 포함하지 않는다. 서버 이름 제안은 kride-pilot-cpu이며 실제 서버는 아직 확인되지 않았다.

사용자는 전용 VPS의 존재 여부·서버 ID를 알려주면 된다. 새 구매가 필요하면 결제 기간, 세금 포함 총액, 갱신 금액, 자동 갱신과 추가 옵션을 실제 주문 화면에서 확인한 뒤 결정한다. 기존 LLM 시험의 하루 1달러 제한은 VPS 구매 예산이 아니다. 키·비밀번호를 채팅으로 보내지 않는다. 지금 터미널 명령이나 기존 정답 재검수는 필요 없다.

## 실행 순서와 완료 증거

1. 대상 확인: 새 VPS ID·IP·SSH 호스트 지문을 기록하고 운영 VPS와 다름을 확인한다. 이미 있는 서버의 재설치나 운영 SSH 별칭 재사용을 하지 않는다. Ubuntu 24.04 Plain을 선택하며 패널·Docker·자동 앱 템플릿은 요구하지 않는다. 제공된 관리 접속만 쓰고 운영 개인 키·API 토큰을 VPS에 복사하지 않는다. SSH agent forwarding도 사용하지 않는다.
2. Linux 환경 설치: 준비 기간에만 필요한 다운로드를 한다. Python 3.11 계열을 우선 비교하되 정확한 Linux 빌드와 네이티브 wheel 가용성을 확인해 고정한다. Ubuntu 기본 Python에 맞춰 조용히 버전을 바꾸지 않는다. Windows 주요 버전 비교 기준은 {"chromadb": "1.5.9", "numpy": "2.4.6", "sentence-transformers": "6.1.0", "tokenizers": "0.23.2", "torch": "2.14.1+cpu", "transformers": "5.18.0"}. 이는 Linux 설치 lock이 아니다.
3. 해시 고정: Python 실행본·표준 라이브러리, 모든 전이 의존 wheel 및 설치 파일, CPU 라이브러리와 실제 연결 .so, tokenizer/config/가중치, 문서·질문 규칙·설정을 SHA256으로 고정한다. OS 릴리스·커널·dpkg 버전과 관련 deb 파일 출처/해시도 기록한다. 다운로드 파일 해시만으로 출처 신뢰가 생기는 것은 아니므로 공식 저장소의 검증 정보도 남긴다. pip freeze만으로 전체 고정 완료라고 하지 않는다. 로그·캐시 같은 가변 파일은 범위를 따로 명시하고 서버 전체가 불변이라고 주장하지 않는다.
4. 파일 전달: transfer-manifest.json의 15개 허용 파일만 전달 후보로 삼는다. 현재 로컬 모델 10개 해시와 후보1,000·질문120개를 확인했다. 전송 후 다시 검증해야 한다. 옛 Chroma·전체40,664개 원본·운영 볼륨·Windows runtime은 전달하지 않는다. 모델 revision은 614241f622f53c4eeff9890bdc4f31cfecc418b3이며 후보·정답·문서·품질 기준은 v2 그대로다.
5. 보존: 설치 쓰기가 끝난 상태에서 실행본·wheelhouse·설정·manifest를 별도 영속 보관본으로 묶고 해시를 남긴다. 이것은 시스템 전체 복구본과 다르다. 전용 VPS의 스냅샷은 완료 상태·ID·시각·만료 시각을 기록한다. Hostinger 공식 문서는 현재 스냅샷1개·1일 만료·새 생성 시 이전 것 대체를 안내하므로 스냅샷만으로 검토 대기를 보장하지 않는다. 기존 스냅샷을 조용히 덮어쓰지 않는다. 가동 중 단순 디스크 복사를 완전한 스냅샷이라고 하지 않는다.
6. 통신·파일 제한: Hostinger 관리형 방화벽의 수신 제한과 VPS 내부 발신 제한을 구분한다. 관리 SSH는 정한 관리 주소에서만 받고 응답 연결을 허용한다. 검색 계정은 별도 network namespace 등 OS 제약으로 IPv4/IPv6 TCP/UDP/DNS가 차단돼야 한다. root/권한 상승·운영 인증정보를 주지 않는다. 모델·입력·runtime은 읽기 전용, 출력은 전용 경로만 쓰게 한다. 관리 복구 통로와 되돌림을 확인한 후 전용 VPS 규칙을 적용한다. 실제 규칙은 대상 주소를 확정한 뒤 만든다.
7. 경계 재검증: root 설정값만 보지 않고 실제 비권한 실행 계정에서 권한·환경키·mount·쓰기 제한·네트워크 음성 검사를 한다. 원본/운영으로 실제 접속을 시도하지 않고 합성 금지 파일과 경로, 인터페이스·라우트·방화벽 증거를 사용한다. 허용 출력 쓰기는 성공하고 금지 위치 쓰기, 권한 상승, 외부 연결은 실패해야 한다. Linux 패키지 import/모델 로드 검사까지만 허용하고 임베딩 계산과 Chroma client 생성은 하지 않는다. 설치 후 변화가 있으면 lock과 검사를 다시 만든다.
8. 검토 대기: executionAllowed=false, 검색용 systemd/cron/부팅 자동 실행 없음, 데이터베이스 없음 상태를 증거로 남긴다. 네트워크 제한 이전 스냅샷으로 복구하면 제한과 경계 검사를 다시 수행한다. 제한 후 설정 해시와 증거도 영속 보관본에 별도 추가한다. WSL의 8/8 결과를 VPS 통과 증거로 사용하지 않는다.

## 별도 실행 승인 이후에만

승인은 VPS ID·실행본/입력/설정 manifest 해시·출력 경로·1,000개 범위·120개 질문·시간/자원 제한에 연결한다. 파일럿은 수동 시작하며 Boolean만 바꿔 자동으로 실행하지 않는다. 기존 v2의 A/B는 저장 벡터를 공유하고 질문 접두사만 바꾼다. C는 별도 비교이며 문서 변화와 질문 변화의 효과를 섞지 않는다. 한국어·영어·일본어별 Recall@5/nDCG@10, 근거없음, ANN 일치도, 지연/메모리를 별도로 평가한다. 기존 품질 목표는 제안/고정 기준이며 이번 통과 결과가 아니다.

검색 품질과 공개 API 출처 계약은 별도다. v2는 publicEligibleCount=0으로 기록돼 있으므로 벡터 검색이 좋아져도 서비스용 출처 URL·좌표·지역·예산·아티스트 근거의 통과로 확대하지 않는다. 전량 재색인과 운영 전환은 현재 범위에 없다.

## 보존 근거

v2 pilot-spec SHA256: f2e47aa5ba6025203eaa860769d06bac09d0461d224e20120c629f696715fadd. 기존 파일을 수정하지 않고 새 preparation-contract.json / transfer-manifest.json을 추가했다. 실제 Linux 해시·VPS ID·snapshot ID는 아직 없으므로 null로 남겼다. 연결된 Hostinger 전용 관리 도구는 이번 세션에서 발견되지 않았으며, 대상 서버와 접근 방식이 확인되기 전 원격 설치를 진행하지 않는다.

## 공식 출처 (2026-10-06 확인)

- KVM 2 자원: https://www.hostinger.com/vps/ubuntu-hosting
- Ubuntu 템플릿: https://www.hostinger.com/support/1583571-what-are-the-available-operating-systems-for-vps-at-hostinger/
- 스냅샷: https://www.hostinger.com/support/1583232-how-to-back-up-or-restore-a-vps-at-hostinger/
- 관리형 방화벽: https://www.hostinger.com/support/8172641-how-to-use-a-managed-vps-firewall-at-hostinger/
