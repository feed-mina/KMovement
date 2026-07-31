import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import axios from "@/services/axios";
import { useAuth } from "@/context/AuthContext";
import { useMetadata } from "@/components/providers/MetadataProvider";
import { parseJsonbFields } from "@/components/utils/dataParser";


//  @@@@ usePageMetadata 역할 : 데이터 관리자 역할이다. 메타데이터가져오기 , 원본 데이터 가져오기 , 가져온 데이터를 pageData로 담아줌, 로딩중인지 전체 개수가 몇개인지 같은 페이지의 전역 상태를 관리
export function resolveDataApiUrl(
    template: string,
    params: Record<string, unknown>
): string | null {
    let missingValue = false;
    const resolved = template.replace(/\{([A-Za-z0-9_]+)\}|:([A-Za-z][A-Za-z0-9_]*)/g, (_match, bracedKey, colonKey) => {
        const key = bracedKey || colonKey;
        const value = params[key];
        if (value === undefined || value === null || value === "") {
            missingValue = true;
            return "";
        }
        return encodeURIComponent(String(value));
    });

    return missingValue ? null : resolved;
}

/**
 * 프레임워크가 채워 주는 파라미터. 화면 상태(페이지 위치·상세 대상)에서 나오므로
 * 메타데이터에 값을 적어 둘 수 없고, 쓰겠다는 선언만 할 수 있다.
 */
export const FRAMEWORK_PARAMS = ['pageSize', 'offset', 'filterId', 'contentId'] as const;
export type FrameworkParam = typeof FRAMEWORK_PARAMS[number];

export interface ExecuteContext {
    pageSize: number;
    offset: number;
    filterId?: string;
    contentId?: string | number | null;
}

function isFrameworkParam(name: string): name is FrameworkParam {
    return (FRAMEWORK_PARAMS as readonly string[]).includes(name);
}

/**
 * DATA_SOURCE 의 component_props.frameworkParams 를 읽는다.
 *
 * 예: {"frameworkParams": ["pageSize", "offset"]}
 *
 * 선언하지 않은 소스에는 아무것도 얹지 않는다. 백엔드(QueryParameterPolicy)가
 * param_mapping 에 없는 파라미터를 거절하기 때문에, 추측해서 보내면 화면이 통째로
 * 실패한다. 모르면 보내지 않는 쪽이 안전하다.
 */
export function readFrameworkParams(props: unknown): FrameworkParam[] {
    const declared = (props as { frameworkParams?: unknown } | null | undefined)?.frameworkParams;
    if (!Array.isArray(declared)) return [];
    const unique = new Set<FrameworkParam>();
    declared.forEach((name) => {
        if (typeof name === 'string' && isFrameworkParam(name)) unique.add(name);
    });
    return [...unique];
}

/**
 * 쿼리에 실려 나갈 파라미터를 만든다.
 *
 * 규칙은 하나다 — 메타데이터가 선언한 것만 보낸다.
 * data_params 의 값은 그대로, component_props.frameworkParams 로 선언한 것은
 * 현재 화면 상태에서 채워 넣는다. sql_key 접두사로 추측하지 않는다.
 */
export function buildExecuteParams(
    parsedParams: Record<string, unknown>,
    context: ExecuteContext,
    declaredFrameworkParams: readonly FrameworkParam[] = [],
): Record<string, unknown> {
    const params: Record<string, unknown> = { ...parsedParams };

    declaredFrameworkParams.forEach((name) => {
        switch (name) {
            case 'pageSize':
                params.pageSize = context.pageSize;
                break;
            case 'offset':
                params.offset = context.offset;
                break;
            case 'filterId':
                params.filterId = context.filterId || '';
                break;
            case 'contentId':
                params.contentId = context.contentId ?? null;
                break;
        }
    });

    return params;
}

export function buildDirectApiParams(
    parsedParams: Record<string, unknown>
): Record<string, unknown> {
    return { ...parsedParams };
}

export const usePageMetadata = (
    screenId: string,
    currentPage: number,
    isOnlyMine: boolean,
    refId: string | number | null,
    showPassword?: boolean,
    pageSizeOverride = 5,
) => {
    const router = useRouter();
    const { user, isLoggedIn } = useAuth();

    const { menuTree, isLoading: metaLoading, screenId: providerScreenId } = useMetadata();

    const [metadata, setMetadata] = useState<any[]>([]); // 원본 메타데이터
    const [totalCount, setTotalCount] = useState(0);
    const [pageData, setPageData] = useState<any>({});
    const [loading, setLoading] = useState(true);

    // * 우선순위를 결정 (전달받은 screenId || Provider의 screenId)  -> (providerScreenId) 공통 헤더, 사이드바가 있다
    const finalScreenId = screenId || providerScreenId;

    // *  useEffect의 의존성 배열 : screenId, providerScreenId, menuTree  
    useEffect(() => {
        // 로그인이 된 상태인데 screenId 가 Login_PAGE 이면 MAIN_PAGE 로 보낸다.
        if (isLoggedIn && finalScreenId?.includes("LOGIN_PAGE")) {
            router.push("/view/MAIN_PAGE");
        }
    }, [isLoggedIn, finalScreenId, router]);

    // ** 로직1:  MetadataProvider에서 context로 가져온 값 menuTree를 metadata라는 로컬상태에 저장한다. (screenId로 화면구분)
    useEffect(() => {
        // loadMetadata : 화면을 그리기 위해 필요한 메타데이터를 가져온다. await axios.get(`/api/ui/${screenId}`);
        const loadMetadata = async () => {
            // 1. 요청한 screenId가 현재 페이지와 같다면 Provider의 캐시를 사용
            if (screenId === providerScreenId && menuTree && menuTree.length > 0) {
                setMetadata(menuTree);
                setLoading(false);
                return;
            }

            // 2. 요청한 screenId가 다르거나(예: GLOBAL_HEADER), Provider에 데이터가 없다면 직접 호출
            if (screenId && screenId !== providerScreenId) {
                setLoading(true);
                try {
                    const res = await axios.get(`/api/ui/${screenId}`);
                    // 서버 응답 구조 {"status":"success", "data": [...]} 반영
                    setMetadata(res.data.data || []);
                } catch (error) {
                    // console.error("Metadata Direct Fetch Error:", error);
                } finally {
                    setLoading(false);
                }
            }
        };

        loadMetadata();
    }, [screenId, providerScreenId, menuTree]); // 의존성 배열에 인자로 받은 screenId 추가

    const pageSize = pageSizeOverride;

    // ** 로직2: 필터링된 메타데이터 생성 : 재귀탐색 함수를 통해 트리구조를 분석한다.
    // filteredMetadata : 필터링된 메타데이터
    const filteredMetadata = useMemo(() => {

        // filterRecursive : 트리 구조의 아이템들을 재귀적으로 탐색하여 필터링 조건
        const filterRecursive = (items: any[]): any[] => {
            if (!items) return [];
            return items
                .map(item => ({
                    ...item,
                    children: item.children ? filterRecursive(item.children) : null,
                    // 비밀번호 토글 텍스트 관리
                    labelText: item.componentId === "pw_toggle_btn"
                        ? (showPassword ? "숨기기" : "보이기")
                        : item.labelText
                }))
                // * 버튼 필터링 : 유저의 권한이나 로그인 여부에 따라서 버튼을 보여준다.
                .filter(item => {
                    // 로그인 여부에 따른 버튼 제어
                    const guestButtons = ["go_login_btn", "go_tutorial_btn"];
                    const userButtons = ["go_content_btn", "view_content_list_btn"];

                    if (guestButtons.includes(item.componentId)) return !isLoggedIn;
                    if (userButtons.includes(item.componentId)) return isLoggedIn;

                    // 수정하기 버튼 권한 체크 (내 글일 때만) pageData 의 ID와 현재 로그인 ID 일치여부
                    if (item.componentId === "go_modify_btn") {
                        return isLoggedIn && String(user?.userId) === String(pageData?.user_id);
                    }

                    // * 데이터 소스는 화면 렌더링에서 제외한다
                    if (item.componentType === "DATA_SOURCE" || item.component_type === "DATA_SOURCE") {
                        return false;
                    }
                    return true;
                });
        };
        return filterRecursive(metadata);
    }, [metadata, isLoggedIn, user, pageData, showPassword]);


    // getAllComponents : 모든 메타데이터를 한줄로 가져온다.
    const getAllComponents = useCallback((items: any[]): any[] => {
        let res: any[] = [];
        items.forEach(item => {
            res.push(item);
            if (item.children) res = res.concat(getAllComponents(item.children));
        });
        return res;
    }, []);

    // ** 로직3 : 비즈니스 데이터 호출 준비(fetchBusinessData)
    // useEffect의 의존성 배열 : metadata, finalScreenId, currentPage, isOnlyMine, refId, isLoggedIn, user, getAllComponents, router
    useEffect(() => {

        // fetchBusinessData : 
        const fetchBusinessData = async () => {
            //  메타데이터가 없다면 안함
            if (!metadata || metadata.length === 0) return;
            setLoading(true);
            try {
                const allComponents = getAllComponents(metadata);

                // ** 메타데이터의 필드 타입이 DATA_SOURCE 이고  액션 타입이 AUTO_FETCH(자동호출)이면 페이지가 열리자 말자 바로 가져온다 

                // DATA_SOURCE 노드와, ref_data_id가 있는 그룹형 data_sql_key를 자동 조회한다.
                // KRIDE INTRO2/3 메타데이터는 선택지 쿼리 키를 그리드 그룹에 직접 보관한다.
                const sources = allComponents.filter((item: any) => {
                    const type = item.componentType || item.component_type;
                    const actionType = item.actionType || item.action_type;
                    const sqlKey = item.dataSqlKey || item.data_sql_key;
                    const apiUrl = item.dataApiUrl || item.data_api_url;
                    const refId = item.refDataId || item.ref_data_id;
                    const isDataSource = type === "DATA_SOURCE";
                    const isBoundGroupSource = type === "GROUP" && !!refId && (!!sqlKey || !!apiUrl);
                    return (isDataSource && actionType === "AUTO_FETCH" && (!!sqlKey || !!apiUrl)) || isBoundGroupSource;
                });
                // * 메타데이터에 dataSqlKey가 있다면 /api/execute/{key} 형태로 주소를 보낸다

                // dataPromises : 
                const dataPromises = sources.map(async (source: any) => {
                    const sqlKey = source.dataSqlKey || source.data_sql_key;
                    const directApiUrl = source.dataApiUrl || source.data_api_url;
                    let apiUrl;
                    //  apiUrl에 sqlKey 기반 URL만 유지
                    if (sqlKey) {
                        apiUrl = `/api/execute/${sqlKey}`;
                    } else if (directApiUrl) {
                        apiUrl = directApiUrl;
                    }
                    //  * 서버로 보낼 execute가 없다면 [] 로 빈 배열값이 나온다.
                    if (!apiUrl) return { id: source.refDataId || source.ref_data_id || source.componentId || source.component_id, data: [] };

                    // * 메타데이터 중 data_params 는 jsonb 타입이다.
                    //  rawParams : dataParams 또는 data_params 값을 가져온다.
                    const rawParams = source.dataParams || source.data_params || "{}";

                    // parsedParams : 그래도 만약 data_param 값이 string이라면 json으로 변환한다.
                    const parsedParams = typeof rawParams === 'string' ? JSON.parse(rawParams) : rawParams;

                    // * finalParams : 파라미터 조립 (모든 파라미터를 finalParams에 통합, 페이지 번호, 한 페이지당 개수(pageSize), 내 글만 보기 여부(isOnlyMine), 상세Id(refId) 등을 하나로 합침)
                    const finalParams = {
                        ...parsedParams,
                        pageSize,
                        offset: (currentPage - 1) * pageSize,
                        filterId: isOnlyMine ? user?.userId : "",
                        userId: user?.userId || "guest",
                        userSqno: user?.userSqno,
                        contentId: refId || null //  (백엔드 :contentId와 매핑)
                    };
                    // 어떤 프레임워크 파라미터를 쓸지는 메타데이터가 선언한다.
                    const declaredFrameworkParams = readFrameworkParams(source.props ?? source.componentProps);
                    const executeParams = sqlKey
                        ? buildExecuteParams(parsedParams, {
                            pageSize,
                            offset: (currentPage - 1) * pageSize,
                            filterId: isOnlyMine ? user?.userId : '',
                            contentId: refId,
                        }, declaredFrameworkParams)
                        : finalParams;
                    const directApiParams = buildDirectApiParams(parsedParams);

                    if (!sqlKey && directApiUrl) {
                        const resolvedApiUrl = resolveDataApiUrl(String(directApiUrl), finalParams);
                        if (!resolvedApiUrl) {
                            return { id: source.refDataId || source.ref_data_id || source.componentId || source.component_id, data: [] };
                        }
                        apiUrl = resolvedApiUrl;
                    }

                    let res;

                    //** 로직4: 데이터 가공 및 바인딩 : screenId(페이지 파라미터 기준) 조건으로get을 사용하는지 post를 방식 결정한다. 서버에서 받아온 rawData를 화면에 쓰기 편하게 가공한다
                    const usesDirectApi = !sqlKey && !!directApiUrl;
                    if (usesDirectApi) {
                        res = await axios.get(apiUrl, { params: directApiParams });
                    } else if (finalScreenId?.includes("CONTENT_DETAIL") || finalScreenId?.includes("CONTENT_MODIFY") || isOnlyMine) {
                        // 상세 조회나 수정 하기 전에 보이는 부분, 내 글 목록은 GET 방식 사용
                        res = await axios.get(apiUrl, { params: executeParams });
                    } else {
                        // 그 외 일반 목록 등은 POST 방식 사용
                        res = await axios.post(apiUrl, executeParams);
                    }
                    return {
                        id: source.refDataId || source.ref_data_id || source.componentId || source.component_id,
                        data: res.data.data || res.data
                    };
                });

                const results = await Promise.all(dataPromises);
                // combinedData : {} 타입. results를 {id:..., data:...} 형태로 담는다.
                const combinedData: any = {};
                let detectedTotalCount = 0;
                results.forEach((res: any) => {
                    if (res && res.id) {
                        const isError = res.data && res.data.error;
                        const rawResponse = !isError ? res.data : null;

                        if (!rawResponse) {
                            combinedData[res.id] = [];
                            return;
                        }
                        // 1. 상세 페이지 데이터 처리 (단일 데이터 + 평탄화)
                        if (res.id === "content_detail_source") {
                            //  detailData : 상세페이지 데이터
                            const detailData = Array.isArray(rawResponse) ? rawResponse[0] : (rawResponse.data || rawResponse);

                            // console.log('content_detail_source',detailData);
                            if (detailData) {
                                // 공통 함수를 사용하여 jsonb 필드들을 일괄 파싱
                                const processedDetail = parseJsonbFields(detailData);
                                Object.assign(combinedData, processedDetail);

                                // console.log('processedDetail',processedDetail);
                                // console.log('processedDetail.selected_times',processedDetail.selected_times);


                                if (processedDetail.daily_slots && !Array.isArray(processedDetail.daily_slots)) {
                                    Object.assign(combinedData, processedDetail.daily_slots);
                                }
                                // if (processedDetail.selected_times) {
                                //     Object.assign(combinedData, processedDetail.selected_times);
                                // }

                                // 디버깅용 로그 (이게 보여야 성공이야)
                                // console.log("Final combinedData for binding:", combinedData);
                            }
                        }

                        // 2. 목록 페이지 데이터 처리 (리스트 데이터)
                        else {
                            // realList : 
                            const nestedList = rawResponse.list || rawResponse.data;
                            if (!Array.isArray(rawResponse) && typeof rawResponse === "object" && !Array.isArray(nestedList)) {
                                combinedData[res.id] = parseJsonbFields(rawResponse);
                                return;
                            }
                            const realList = Array.isArray(rawResponse) ? rawResponse : (nestedList || []);

                            const unifiedList = realList.map((item: any) => {
                                // parsedItem : 리스트 내부의 각 아이템들도 jsonb 파싱 적용 (나중에 목록에서 필요할 수 있으니까)
                                const parsedItem = parseJsonbFields(item);

                                // formattedDate: 날짜 가공: T와 밀리초를 제거하고 가독성 있게 변경
                                const rawDate = parsedItem.regDt || parsedItem.reg_dt || "";
                                const formattedDate = rawDate ? rawDate.split('T')[0].replace(/-/g, '.') : "";

                                // console.log('parsedItem',parsedItem);
                                return {
                                    ...parsedItem,
                                    content_id: parsedItem.contentId || parsedItem.content_id,
                                    user_id: parsedItem.userId || parsedItem.user_id,
                                    reg_dt: formattedDate,
                                };
                            });

                            combinedData[res.id] = unifiedList;

                            // 목록 응답에 totalCount/total_count가 있으면 공통 페이징 카운트로 사용한다.
                            const responseTotal = rawResponse.total || rawResponse.totalCount || rawResponse.total_count ||
                                (unifiedList[0] && (unifiedList[0].total_count || unifiedList[0].totalCount));
                            if (responseTotal) {
                                detectedTotalCount = responseTotal;
                            }
                        }
                    }
                });

                setPageData(combinedData);
                setTotalCount(detectedTotalCount);
            } catch (error) {
                // console.error("Data Fetching Error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBusinessData();


    }, [metadata, finalScreenId, currentPage, isOnlyMine, refId, isLoggedIn, user, getAllComponents, router]);

    return {
        metadata: filteredMetadata,
        pageData,
        loading: loading || metaLoading,
        totalCount,
        isLoggedIn
    };
};
