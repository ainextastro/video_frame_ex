import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { Upload, Download, Loader2, Image as ImageIcon, Settings, X, ChevronLeft, ChevronRight } from 'lucide-react';

const VideoProcessor = () => {
    const [videoFile, setVideoFile] = useState(null);
    const [videoUrl, setVideoUrl] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [extractedFrames, setExtractedFrames] = useState([]);
    const [frameInterval, setFrameInterval] = useState(1);
    const [isComplete, setIsComplete] = useState(false);
    const [selectedFrame, setSelectedFrame] = useState(null);
    const [zipFileName, setZipFileName] = useState('extracted_frames');

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const urlsRef = useRef({ video: null, frames: [] });

    useEffect(() => {
        urlsRef.current.video = videoUrl;
        urlsRef.current.frames = extractedFrames;
    }, [videoUrl, extractedFrames]);

    useEffect(() => {
        return () => {
            if (urlsRef.current.video) URL.revokeObjectURL(urlsRef.current.video);
            urlsRef.current.frames.forEach(f => URL.revokeObjectURL(f.url));
        };
    }, []);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            // セキュリティチェック1: ファイルサイズ制限 (500MB)
            const MAX_FILE_SIZE = 500 * 1024 * 1024;
            if (file.size > MAX_FILE_SIZE) {
                alert('ファイルサイズが大きすぎます。500MB以下のファイルを選択してください。');
                event.target.value = ''; // 入力をリセット
                return;
            }

            // セキュリティチェック2: ファイル拡張子の検証
            const validExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
            const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
            if (!validExtensions.includes(fileExtension)) {
                alert('サポートされていないファイル形式です。対応形式: MP4, WebM, OGG, MOV, AVI');
                event.target.value = '';
                return;
            }

            // セキュリティチェック3: MIMEタイプ検証
            const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
            if (!validVideoTypes.includes(file.type)) {
                alert('ファイル形式の検証に失敗しました。正しい動画ファイルを選択してください。');
                event.target.value = '';
                return;
            }

            if (videoUrl) URL.revokeObjectURL(videoUrl);
            extractedFrames.forEach(f => URL.revokeObjectURL(f.url));

            setVideoFile(file);
            const url = URL.createObjectURL(file);
            setVideoUrl(url);
            setExtractedFrames([]);
            setIsComplete(false);
            setProgress(0);
        }
    };

    const extractFrames = async () => {
        if (!videoRef.current) return;

        setIsProcessing(true);
        setIsComplete(false);
        setExtractedFrames([]);
        setProgress(0);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const duration = video.duration;
        const width = video.videoWidth;
        const height = video.videoHeight;

        // セキュリティチェック4: 動画の長さ制限（30分）
        const MAX_DURATION = 30 * 60; // 30分
        if (duration > MAX_DURATION) {
            alert('動画が長すぎます。30分以下の動画を選択してください。');
            setIsProcessing(false);
            return;
        }

        // セキュリティチェック5: 予想フレーム数の確認
        const estimatedFrames = Math.ceil(duration / parseFloat(frameInterval));
        const MAX_FRAMES = 1000;
        if (estimatedFrames > MAX_FRAMES) {
            const minInterval = (duration / MAX_FRAMES).toFixed(1);
            alert(`抽出フレーム数が多すぎます（予想: ${estimatedFrames}枚）。\n間隔を${minInterval}秒以上に設定してください。`);
            setIsProcessing(false);
            return;
        }

        canvas.width = width;
        canvas.height = height;

        const frames = [];
        let currentTime = 0;

        const captureFrame = async () => {
            return new Promise((resolve) => {
                const onSeeked = () => {
                    ctx.drawImage(video, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/png');
                };

                video.addEventListener('seeked', onSeeked, { once: true });
                video.currentTime = currentTime;
            });
        };

        try {
            while (currentTime < duration && frames.length < MAX_FRAMES) {
                const blob = await captureFrame();
                if (blob) {
                    frames.push({
                        time: currentTime,
                        blob: blob,
                        url: URL.createObjectURL(blob)
                    });
                }

                currentTime += parseFloat(frameInterval);
                setProgress(Math.min(Math.round((currentTime / duration) * 100), 100));
            }

            setExtractedFrames(frames);
            setIsComplete(true);
        } catch (error) {
            console.error("Error extracting frames:", error);
            alert("処理中にエラーが発生しました。別の動画で再度お試しください。");
        } finally {
            setIsProcessing(false);
            video.currentTime = 0;
        }
    };

    const sanitizeFileName = (filename) => {
        // セキュリティチェック3: ファイル名のサニタイズ
        // 危険な文字を除去（パストラバーサル攻撃対策）
        return filename
            .replace(/[^a-zA-Z0-9_\-]/g, '_')  // 英数字、アンダースコア、ハイフンのみ許可
            .substring(0, 100);  // 最大100文字に制限
    };

    const downloadZip = async () => {
        if (extractedFrames.length === 0) return;

        const zip = new JSZip();
        const folder = zip.folder("frames");

        extractedFrames.forEach((frame, index) => {
            const fileName = `frame_${index + 1}_${frame.time.toFixed(2)}s.png`;
            folder.file(fileName, frame.blob);
        });

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = url;
        // サニタイズされたファイル名を使用
        const safeFileName = sanitizeFileName(zipFileName) || 'extracted_frames';
        a.download = `${safeFileName}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200 rounded-3xl p-10 shadow-xl relative overflow-hidden">
            {!videoUrl && (
                <div className="border-2 border-dashed border-gray-300 rounded-3xl p-20 text-center hover:border-blue-500 hover:bg-blue-50/50 transition-all duration-300 group cursor-pointer relative overflow-hidden animate-scale-in">
                    <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center gap-6 relative z-0">
                        <div className="p-8 bg-gray-100 rounded-full group-hover:bg-blue-500 group-hover:scale-105 transition-all duration-300 animate-float">
                            <Upload size={48} className="text-gray-600 group-hover:text-white transition-colors" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-semibold text-gray-900">動画をアップロード</h3>
                            <p className="text-gray-500 mt-2">クリックまたはドラッグ＆ドロップ</p>
                        </div>
                    </div>
                </div>
            )}

            {videoUrl && (
                <div className="space-y-6 animate-slide-up">
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-video shadow-lg group animate-scale-in">
                        <video
                            ref={videoRef}
                            src={videoUrl}
                            className="w-full h-full object-contain"
                            controls
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        <div className="absolute top-4 right-4">
                            <label className="cursor-pointer bg-white/90 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl border border-gray-300 hover:border-gray-400 transition-all flex items-center gap-2 shadow-sm hover:shadow-md">
                                <Upload size={18} />
                                <span className="text-sm font-medium">動画を変更</span>
                                <input
                                    type="file"
                                    accept="video/*"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                            <div className="flex items-center gap-2 mb-4 text-gray-700">
                                <Settings size={18} />
                                <span className="font-medium">抽出設定</span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <label className="text-sm text-gray-600 w-20">間隔 (秒):</label>
                                    <input
                                        type="number"
                                        min="0.1"
                                        max="60"
                                        step="0.1"
                                        value={frameInterval}
                                        onChange={(e) => {
                                            // セキュリティチェック4: 入力値の検証
                                            const value = parseFloat(e.target.value);
                                            if (value >= 0.1 && value <= 60) {
                                                setFrameInterval(e.target.value);
                                            }
                                        }}
                                        disabled={isProcessing}
                                        className="bg-white border border-gray-300 rounded-xl px-4 py-2 text-gray-900 w-24 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="text-sm text-gray-600 w-20">ZIP名:</label>
                                    <input
                                        type="text"
                                        value={zipFileName}
                                        onChange={(e) => {
                                            // セキュリティチェック5: リアルタイムでファイル名を制限
                                            const value = e.target.value.substring(0, 100);
                                            setZipFileName(value);
                                        }}
                                        placeholder="ファイル名（英数字、_、-のみ）"
                                        maxLength={100}
                                        className="bg-white border border-gray-300 rounded-xl px-4 py-2 text-gray-900 flex-1 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 flex flex-col justify-center gap-3">
                            {!isComplete ? (
                                <button
                                    onClick={extractFrames}
                                    disabled={isProcessing}
                                    className={`w-full py-3.5 px-6 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all duration-200 ${isProcessing
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:scale-[1.02]'
                                        }`}
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 size={22} className="animate-spin" />
                                            <span>処理中... {progress}%</span>
                                        </>
                                    ) : (
                                        <>
                                            <ImageIcon size={22} />
                                            <span>フレームを抽出開始</span>
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={downloadZip}
                                    className="w-full py-3.5 px-6 rounded-xl font-semibold flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30 hover:shadow-green-500/40 transition-all duration-200 hover:scale-[1.02]"
                                >
                                    <Download size={22} />
                                    <span>ZIPをダウンロード ({extractedFrames.length}枚)</span>
                                </button>
                            )}

                            {isComplete && (
                                <button
                                    onClick={() => {
                                        extractedFrames.forEach(f => URL.revokeObjectURL(f.url));
                                        setExtractedFrames([]);
                                        setIsComplete(false);
                                        setProgress(0);
                                    }}
                                    className="text-sm text-gray-500 hover:text-gray-700 text-center font-medium"
                                >
                                    やり直す
                                </button>
                            )}
                        </div>
                    </div>

                    {extractedFrames.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-base font-medium text-gray-700">プレビュー ({extractedFrames.length}枚)</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto p-3 bg-gray-50 rounded-lg border border-gray-200">
                                {extractedFrames.map((frame, i) => (
                                    <div
                                        key={i}
                                        className="aspect-video bg-gray-200 rounded-lg overflow-hidden relative group shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                                        onClick={() => setSelectedFrame(i)}
                                    >
                                        <img
                                            src={frame.url}
                                            alt={`Frame ${i}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm font-medium text-white">
                                            {frame.time.toFixed(1)}s
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {selectedFrame !== null && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedFrame(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
                        onClick={() => setSelectedFrame(null)}
                    >
                        <X size={32} />
                    </button>

                    {selectedFrame > 0 && (
                        <button
                            className="absolute left-4 text-white hover:text-gray-300 transition-colors bg-gray-800/50 hover:bg-gray-700/50 p-3 rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFrame(selectedFrame - 1);
                            }}
                        >
                            <ChevronLeft size={32} />
                        </button>
                    )}

                    {selectedFrame < extractedFrames.length - 1 && (
                        <button
                            className="absolute right-4 text-white hover:text-gray-300 transition-colors bg-gray-800/50 hover:bg-gray-700/50 p-3 rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFrame(selectedFrame + 1);
                            }}
                        >
                            <ChevronRight size={32} />
                        </button>
                    )}

                    <div className="max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={extractedFrames[selectedFrame].url}
                            alt={`Frame ${selectedFrame}`}
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        />
                        <div className="text-center mt-4 text-white">
                            <p className="text-lg font-medium">
                                フレーム {selectedFrame + 1} / {extractedFrames.length}
                            </p>
                            <p className="text-gray-400">
                                {extractedFrames[selectedFrame].time.toFixed(2)}秒
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoProcessor;
