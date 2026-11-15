'use client';

import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { dataUrlToFile } from './communityShared';

export function SketchPad({
    onSave,
    onClose,
}: {
    onSave: (file: File, dataUrl: string) => void;
    onClose: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const historyRef = useRef<string[]>([]);
    const [brushColor, setBrushColor] = useState('#111827');
    const [brushSize, setBrushSize] = useState(10);
    const [isErasing, setIsErasing] = useState(false);
    const [canvasSize, setCanvasSize] = useState({ w: 640, h: 480 });

    useEffect(() => {
        const updateSize = () => {
            const maxW = Math.min(window.innerWidth - 48, 640);
            const h = Math.round(maxW * 0.75); // 4:3 비율 유지
            setCanvasSize({ w: maxW, h });
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const prepareCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.lineCap = 'round';
        context.lineJoin = 'round';
    }, []);

    useEffect(() => {
        prepareCanvas();
    }, [prepareCanvas, canvasSize]);

    const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * (canvas.width / rect.width),
            y: (event.clientY - rect.top) * (canvas.height / rect.height),
        };
    };

    const pushHistory = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        historyRef.current = [...historyRef.current.slice(-12), canvas.toDataURL('image/png')];
    };

    const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;
        pushHistory();
        drawingRef.current = true;
        canvas.setPointerCapture(event.pointerId);
        const point = getPoint(event);
        context.beginPath();
        context.moveTo(point.x, point.y);
    };

    const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!context) return;
        const point = getPoint(event);
        context.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
        context.strokeStyle = brushColor;
        context.lineWidth = brushSize;
        context.lineTo(point.x, point.y);
        context.stroke();
    };

    const stopDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
    };

    const clearCanvas = () => {
        pushHistory();
        prepareCanvas();
    };

    const undo = () => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        const previous = historyRef.current.pop();
        if (!canvas || !context || !previous) return;
        const image = new Image();
        image.onload = () => {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
        };
        image.src = previous;
    };

    const saveSketch = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        const filename = `kride-doodle-sketch-${Date.now()}.png`;
        onSave(dataUrlToFile(dataUrl, filename), dataUrl);
    };

    return (
        <div className="community-sketch-backdrop" role="dialog" aria-modal="true" aria-label="스케치 도구">
            <div className="community-sketch-panel">
                <div className="community-sketch-header">
                    <div>
                        <h2>스케치</h2>
                        <p>그린 이미지는 글의 첨부 이미지로 저장됩니다.</p>
                    </div>
                    <button className="community-secondary-btn" type="button" onClick={onClose}>
                        닫기
                    </button>
                </div>

                <canvas
                    ref={canvasRef}
                    className="community-sketch-canvas"
                    width={canvasSize.w}
                    height={canvasSize.h}
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerCancel={stopDrawing}
                    onPointerLeave={(event) => {
                        if (drawingRef.current) stopDrawing(event);
                    }}
                />

                <div className="community-sketch-tools">
                    <div className="community-sketch-swatches" aria-label="펜 색상">
                        {['#111827', '#2563eb', '#dc2626', '#16a34a'].map((color) => (
                            <button
                                key={color}
                                type="button"
                                aria-label={`${color} 색상`}
                                className={brushColor === color && !isErasing ? 'active' : ''}
                                style={{ backgroundColor: color }}
                                onClick={() => {
                                    setBrushColor(color);
                                    setIsErasing(false);
                                }}
                            />
                        ))}
                    </div>
                    <label className="community-sketch-size">
                        굵기
                        <input
                            type="range"
                            min={3}
                            max={28}
                            value={brushSize}
                            onChange={(event) => setBrushSize(Number(event.target.value))}
                        />
                    </label>
                    <button
                        className={isErasing ? 'community-primary-btn' : 'community-secondary-btn'}
                        type="button"
                        onClick={() => setIsErasing((value) => !value)}
                    >
                        지우개
                    </button>
                    <button className="community-secondary-btn" type="button" onClick={undo}>
                        되돌리기
                    </button>
                    <button className="community-danger-btn" type="button" onClick={clearCanvas}>
                        비우기
                    </button>
                    <button className="community-primary-btn" type="button" onClick={saveSketch}>
                        저장
                    </button>
                </div>
            </div>
        </div>
    );
}
