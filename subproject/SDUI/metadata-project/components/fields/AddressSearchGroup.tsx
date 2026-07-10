import React, { useState } from "react";
import DaumPostcodeEmbed from "react-daum-postcode";

// @@@@ AddressSearchGroup: 외부 라이브러리 데이터를 엔진의 formData로 넘겨주는 브릿지 컴포넌트
const AddressSearchGroup = ({ meta, formData = {}, setFormData, onAction }: any) => {
    const [isPopupOpen, setIsPopupOpen] = useState(false);

    // 주소 선택 완료 시 실행되는 핸들러
    const handleComplete = (data: any) => {
        if (!setFormData) {
            console.warn('[AddressSearchGroup] setFormData is not provided');
            return;
        }

        // 1. 우편번호와 도로명 주소를 formData에 바인딩
        setFormData((prev: any) => ({
            ...prev,
            zip_code: data.zonecode,
            road_address: data.address,
        }));

        // 2. 팝업 닫기
        setIsPopupOpen(false);

        // (선택 사항) 주소 입력이 완료되었다는 액션을 엔진에 알릴 경우
        if (onAction) {
            onAction(meta, data);
        }
    };

    // meta에서 label 정보 추출
    const label = meta?.labelText || meta?.label_text || meta?.label || '';

    return (
        <div className="address-group-container space-y-2 mb-4">
            {/* 1. 라벨 (DB에서 넘어온 meta.labelText 사용) */}
            {label && <label className="text-sm font-bold block mb-1">{label}</label>}

            {/* 2. 우편번호 & 검색 버튼 영역 */}
            <div className="flex gap-2 mb-2">
                <input
                    value={formData?.zip_code || ''}
                    readOnly
                    placeholder="우편번호"
                    className="bg-gray-100 p-2 border rounded flex-1 cursor-default focus:outline-none"
                />
                <button
                    type="button"
                    onClick={() => setIsPopupOpen(true)}
                    className="bg-accent text-white px-4 py-2 rounded hover:bg-accent-strong transition-colors"
                >
                    주소 찾기
                </button>
            </div>

            {/* 3. 도로명 주소창 (수정 불가) */}
            <input
                value={formData?.road_address || ''}
                readOnly
                placeholder="도로명 주소"
                className="w-full bg-gray-100 p-2 border rounded mb-2 cursor-default focus:outline-none"
            />

            {/* 4. 상세 주소창 (직접 입력 가능) */}
            <input
                value={formData?.detail_address || ''}
                placeholder="상세 주소를 입력하세요"
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                onChange={(e) => {
                    if (setFormData) {
                        setFormData((prev: any) => ({ ...prev, detail_address: e.target.value }));
                    }
                }}
            />

            {/* 5. 주소 검색 모달 (팝업) */}
            {isPopupOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="relative w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <span className="font-bold">주소 검색</span>
                            <button
                                onClick={() => setIsPopupOpen(false)}
                                className="text-gray-500 hover:text-black text-xl"
                            >
                                &times;
                            </button>
                        </div>
                        <DaumPostcodeEmbed
                            onComplete={handleComplete}
                            style={{ height: '450px' }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddressSearchGroup;