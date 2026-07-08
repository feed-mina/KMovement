'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { ResumeInputType } from '@/lib/types/ai';
import Rai from '@/components/fields/kride/atoms/Rai';
import api from '@/services/axios';

interface AIInterviewIntroProps {
    title: string;
    resumeInputType: ResumeInputType;
    onInputTypeChange: (type: ResumeInputType) => void;
    resumeText: string;
    onResumeChange: (text: string) => void;
    resumeFileKey: string | null;
    onFileKeyChange: (key: string | null, fileName?: string) => void;
    onStart: () => void;
    isLoading?: boolean;
    placeholder?: string;
    startBtnLabel?: string;
}

const INPUT_TABS: { type: ResumeInputType; label: string }[] = [
    { type: 'text',  label: '📝 텍스트' },
    { type: 'image', label: '🖼️ 이미지' },
    { type: 'pdf',   label: '📄 PDF' },
];

export default function AIInterviewIntro({
    title,
    resumeInputType,
    onInputTypeChange,
    resumeText,
    onResumeChange,
    resumeFileKey,
    onFileKeyChange,
    onStart,
    isLoading,
    placeholder,
    startBtnLabel,
}: AIInterviewIntroProps) {
    const imageInputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef   = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const uploadFile = async (file: File) => {
        setUploading(true);
        setUploadError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/api/ai/interview/resume/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const { fileKey } = res.data?.data ?? {};
            onFileKeyChange(fileKey, file.name);
            setFileName(file.name);
        } catch {
            setUploadError('파일 업로드에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setUploading(false);
        }
    };

    const handleImageFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(file));
        e.target.value = '';
        await uploadFile(file);
    };

    const handlePdfFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        await uploadFile(file);
    };

    const handleRemove = () => {
        onFileKeyChange(null);
        setFileName(null);
        if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
        setUploadError(null);
    };

    const isStartable = (() => {
        if (isLoading || uploading) return false;
        if (resumeInputType === 'text')  return resumeText.trim().length > 0;
        if (resumeInputType === 'image') return resumeFileKey !== null;
        if (resumeInputType === 'pdf')   return resumeFileKey !== null;
        return false;
    })();

    return (
        <div className="ai-intro-container">
            <div className="ai-intro-icon-box">
                <Rai state={isLoading ? 'thinking' : 'greeting'} size={108} />
            </div>

            <div className="ai-intro-header">
                <h1 className="ai-intro-title">{title}</h1>
                <p className="ai-intro-subtitle">AI 면접</p>
            </div>

            <div className="ai-permission-card">
                <div className="ai-permission-header">
                    <span className="ai-mic-emoji text-2xl">📋</span>
                    <span className="ai-mic-label">Resume / CV</span>
                </div>
                <p className="ai-permission-desc">
                    이력서를 입력하면 AI가 분석 후 면접을 시작합니다.
                </p>

                {/* 입력 방식 탭 */}
                <div className="ai-resume-tab-group">
                    {INPUT_TABS.map(({ type, label }) => (
                        <button
                            key={type}
                            className={`ai-resume-tab ${resumeInputType === type ? 'active' : ''}`}
                            onClick={() => { onInputTypeChange(type); handleRemove(); }}
                            disabled={isLoading || uploading}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* 텍스트 입력 */}
                {resumeInputType === 'text' && (
                    <textarea
                        className="ai-resume-textarea"
                        value={resumeText}
                        onChange={e => onResumeChange(e.target.value)}
                        placeholder={placeholder || '이력서 내용을 여기에 붙여넣으세요...\n\n예) 이름, 경력, 프로젝트, 기술 스택 등'}
                        rows={7}
                        disabled={isLoading}
                    />
                )}

                {/* 이미지 업로드 */}
                {resumeInputType === 'image' && (
                    <div className="ai-resume-upload-area">
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style={{ display: 'none' }}
                            onChange={handleImageFile}
                        />
                        {resumeFileKey ? (
                            <div className="ai-resume-preview">
                                {previewUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={previewUrl} alt="이력서 이미지" className="ai-resume-preview-img" />
                                )}
                                <button
                                    className="ai-resume-remove-btn"
                                    onClick={handleRemove}
                                    disabled={isLoading}
                                >
                                    ✕ 제거
                                </button>
                            </div>
                        ) : (
                            <button
                                className="ai-resume-upload-btn"
                                onClick={() => imageInputRef.current?.click()}
                                disabled={isLoading || uploading}
                            >
                                <span className="ai-upload-icon">{uploading ? '⏳' : '🖼️'}</span>
                                <span>{uploading ? '업로드 중...' : '이미지 선택'}</span>
                                <span className="ai-upload-hint">JPG, PNG, WEBP 지원</span>
                            </button>
                        )}
                        {uploadError && (
                            <p style={{ color: 'red', fontSize: '0.8rem', marginTop: 6 }}>{uploadError}</p>
                        )}
                    </div>
                )}

                {/* PDF 업로드 */}
                {resumeInputType === 'pdf' && (
                    <div className="ai-resume-upload-area">
                        <input
                            ref={pdfInputRef}
                            type="file"
                            accept="application/pdf"
                            style={{ display: 'none' }}
                            onChange={handlePdfFile}
                        />
                        {resumeFileKey ? (
                            <div className="ai-resume-pdf-selected">
                                <span className="ai-pdf-icon">📄</span>
                                <span className="ai-pdf-name">{fileName || 'PDF 파일 선택됨'}</span>
                                <button
                                    className="ai-resume-remove-btn"
                                    onClick={handleRemove}
                                    disabled={isLoading}
                                >
                                    ✕ 제거
                                </button>
                            </div>
                        ) : (
                            <button
                                className="ai-resume-upload-btn"
                                onClick={() => pdfInputRef.current?.click()}
                                disabled={isLoading || uploading}
                            >
                                <span className="ai-upload-icon">{uploading ? '⏳' : '📄'}</span>
                                <span>{uploading ? '업로드 중...' : 'PDF 선택'}</span>
                                <span className="ai-upload-hint">PDF 파일 업로드</span>
                            </button>
                        )}
                        {uploadError && (
                            <p style={{ color: 'red', fontSize: '0.8rem', marginTop: 6 }}>{uploadError}</p>
                        )}
                    </div>
                )}

                <div className="ai-permission-divider" />

                <button
                    className="ai-start-btn"
                    onClick={onStart}
                    disabled={!isStartable}
                >
                    {isLoading ? '이력서 분석 중...' : startBtnLabel || '면접 시작하기'}
                </button>
            </div>
        </div>
    );
}
