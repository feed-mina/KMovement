'use client';

import {useCallback, useEffect, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import axios from "@/services/axios";
import {useRouter} from "next/navigation";
import { useAuth } from "@/context/AuthContext";
// @@@@ useRecordTime 역할 : reactQurey 로 목표시간데이터, 리스트, 도착시간 부분 백앤드와 연결 관리
export const useRecordTime = () => {
    const [remainTimeText, setRemainTimeText] = useState('');
    const queryClient = useQueryClient();
    const router = useRouter(); // window.location.href 대신 사용
    const { user, isLoggedIn } = useAuth();

    const isValidUser = isLoggedIn && user?.userSqno && Number(user.userSqno) !== 9999;
    // [API] 목표시간 데이터 가져오기 React Query
    const {data: goalData} = useQuery({
        queryKey: ['goalTime', user?.userSqno],
        queryFn: async () => {
            const res = await axios.get('/api/goalTime/getGoalTime');
            return res.data ?? null;
        },
        enabled: Boolean(isValidUser), // 실제 회원 번호가 있을 때만 호출 (API 최적화)
        retry: false,
        staleTime: 1000 * 60 * 5, // @@@@ 2026-02-08 추가 Infinity 대신 5분으로 변경.
        // staleTime: Infinity
    });
    const goalTime = goalData?.goalTime ?? null;
    const todaysMessage = goalData?.todaysMessage ?? null;


    // [API] 목표시간 리스트 가져오기 useQuery
    const {data: goalList} = useQuery({
        queryKey: ['goalList'],
        queryFn: async () => {
            const res = await axios.get('/api/goalTime/getGoalList');
            return res.data ?? [];
        },
        enabled: Boolean(isValidUser),
        retry: false,
        staleTime: Infinity
    });

    // [API] 도착처리 (Mutation)
    const arrivalMutation = useMutation({
        mutationFn: async (status: string) => {
            return await axios.post('/api/goalTime/arrival', {
                status: status,
                recordTime: new Date()
            });
        },
        onSuccess: () => {
            // 캐시 무효화 후 즉시 refetch (staleTime 무관)
            queryClient.removeQueries({queryKey: ['goalTime']});
            queryClient.removeQueries({queryKey: ['goalList']});
        },
    });

    // 페이지 이동 핸들러
// 핸들러 내부에서 실시간으로 쿠키를 다시 체크합니다.
    const handleLinkToSetup = () => {

        if (!isLoggedIn) {
            alert('로그인이 필요한 서비스입니다.');
        } else {
            router.push('/view/SET_TIME_PAGE');
            // window.location.href = '/view/SET_TIME_PAGE';
        }
    };

    // [도착버튼 핸들러] 도착 버튼 클릭시 상태 계산 (safe, success, fail)
    const handleArrival = useCallback(() => {
        if (!goalTime) return;
        const now = new Date();
        const target = new Date(goalTime);
        const diffMs = target.getTime() - now.getTime();
        const diffMin = diffMs / (1000 * 60); // 분 단위 차이

        let status = "fail";

        if (diffMin < 0) {
            // 목표 시간 지남 -> 지각 (fail)
            status = "fail";
        } else if (diffMin <= 10) {
            // 10분 전 ~ 목표시간 사이 -> 간신히 성공 (safe)
            status = "safe";
        } else {
            // 10분보다 더 많이 남음 -> 여유있게 성공 (success)
            status = "success";
        }
        if (confirm(`현재 상태 ${status.toUpperCase()}\n도착 기록을 보내시겠습니까?`)) {
            arrivalMutation.mutate(status);
        }
    }, [goalTime, arrivalMutation]);


    // [로직]  타이머 계산 로직 1초마다 실행 (useEffect)
    useEffect(() => {
        if (!goalTime) return;
        const targetDate = new Date(goalTime);
        const timer = setInterval(() => {
            const now = new Date();
            // 보여줄 때는 10분 전 기준이 아니라 실제 목표 시간까지 얼마나 남았는지 보여주는 게 일반적이라
            // 여기서는 목표시간 까지 남은 시간까지 남은 시간을 계산한다
            // 10분 전 여유시간 기준 계산
            const targetWithMargin = new Date(targetDate.getTime() - 10 * 60000);

            const diff = targetWithMargin.getTime() - now.getTime();// 1. 전체 남은 분(Total Minutes) 계산
            const totalMinutes = Math.floor(diff / (1000 * 60));

            // 2. 시간(Hour)과 분(Minute)으로 분리
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            if (diff <= 0) {
                setRemainTimeText("지각입니다 ㅠㅠ");
            } else {
                const min = Math.floor(diff / 60000);
                // 3. 화면 표시 포맷 (0시간일 때는 분만, 아니면 '0시간 0분' 형태)
                if (hours > 0) {
                    setRemainTimeText(`${hours}시간 ${minutes}분 남음`);
                } else {
                    setRemainTimeText(`${minutes}분 남음`);
                }
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [goalTime]);

    return {isLoggedIn, goalTime, todaysMessage, goalList, remainTimeText, arrivalMutation, handleLinkToSetup, router, handleArrival};
};
