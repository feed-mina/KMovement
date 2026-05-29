"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { type Lang } from "@/components/LangToggle";
import { 
  Loader2, Plus, ArrowLeft, MessageSquare, User, Clock, 
  MapPin, CheckCircle2, 
  Send, Filter, Megaphone, Trash2, Camera, Share2
} from "lucide-react";
import { translations } from "@/data/translations";
import { 
  fetchBoardPosts, 
  submitBoardPost, 
  updateBoardPost, 
  uploadFile 
} from "@/lib/api";

interface Post {
  content_id: number;
  title: string;
  content?: string;
  user_id: string;
  reg_dt: string;
  day_tag1?: string; // Tab Type: REPORT, LOST, CHEER
  day_tag2?: string; // Hashtags string
  day_tag3?: string; // Location
  emotion?: number;  // Optional
  selected_times?: string; // JSON string for metadata like imageKey
}

type View = "LIST" | "WRITE" | "DETAIL" | "UPDATE";
type BoardTab = "ALL" | "REPORT" | "LOST" | "CHEER";

const POST_TEMPLATES = {
  REPORT: {
    ko: "현재 위치: \n상황: (예: 굿즈 줄 대기 중 / 화장실 현황)\n비고: ",
    en: "Current Location: \nStatus: (e.g., waiting for merch / restroom status)\nNote: ",
    ja: "現在地: \n状況: (例: グッズ待機中 / トイレの状況)\n備考: "
  },
  LOST: {
    ko: "분실물 명칭: \n발견/분실 위치: \n발견/분실 시간: \n특징: ",
    en: "Lost Item: \nLocation: \nTime: \nFeatures: ",
    ja: "紛失物名: \n場所: \n時間: \n特徴: "
  },
  CHEER: {
    ko: "아미 여러분, \n우리 같이 응원해요! \n#BTS #ARMY",
    en: "Dear ARMY, \nLet's cheer together! \n#BTS #ARMY",
    ja: "ARMYの皆さん、 \n一緒に応援しましょう！ \n#BTS #ARMY"
  }
};

const LOCATIONS = [
  "광화문 1번 출구", "세종대왕 동상 앞", "이순신 동상 앞", 
  "교보문고 본점", "KT 광화문빌딩", "경복궁 정문", "광화문 광장 중심"
];

export default function FanBoard({ lang, initialPostId }: { lang: Lang; initialPostId?: string | null }) {
  const [view, setView] = useState<View>("LIST");
  const [activeTab, setActiveTab] = useState<BoardTab>("ALL");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  
  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<Exclude<BoardTab, "ALL">>("REPORT");
  const [hashtags, setHashtags] = useState("");
  const [locationTag, setLocationTag] = useState("");
  const [imageFileKey, setImageFileKey] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bt = translations[lang].boardTabs;
  const bf = translations[lang].boardFields;
  const tt = translations[lang];

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const filterId = activeTab === "ALL" ? undefined : activeTab;
      const data = await fetchBoardPosts({ pageSize: 50, offset: 0, filterId });
      
      if ((data.code === "SUCCESS" || data.status === "success") && Array.isArray(data.data)) {
        setPosts(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (initialPostId) {
      const postId = parseInt(initialPostId);
      if (!isNaN(postId)) {
        openDetail({ content_id: postId } as Post);
      }
    }
  }, [initialPostId]);

  const handlePostTypeChange = (type: Exclude<BoardTab, "ALL">) => {
    setPostType(type);
    if (!content.trim()) {
      setContent(POST_TEMPLATES[type][lang]);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (e.g., 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Max size is 5MB.");
      return;
    }

    setImageUploading(true);
    try {
      const res = await uploadFile(file);
      if (res.code === "SUCCESS" || res.status === "success" || (res.data && res.data.fileKey)) {
        const key = res.data?.fileKey || res.fileKey;
        setImageFileKey(key);
      } else {
        alert("Upload failed: " + (res.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Image upload failed. Please check your connection or login status.");
    } finally {
      setImageUploading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setPostType("REPORT");
    setHashtags("");
    setLocationTag("");
    setImageFileKey(null);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setLoading(true);
    try {
      const postData = {
        title,
        content,
        day_tag1: postType,
        day_tag2: hashtags,
        day_tag3: locationTag,
        emotion: 0, // In this schema, we might store image key in tag or a separate field if available
        // Let's store image key in selected_times for now if schema is rigid
        selected_times: JSON.stringify({ imageKey: imageFileKey }),
        daily_slots: "{}"
      };
      
      let result;
      if (view === "WRITE") {
        result = await submitBoardPost(postData);
      } else {
        result = await updateBoardPost({ 
          ...postData, 
          content_id: selectedPost?.content_id 
        });
      }

      // Backend Success check as requested (status === "success" or code === "SUCCESS")
      if (result.code === "SUCCESS" || result.status === "success") {
        alert(tt.boardSuccess);
        resetForm();
        setView("LIST");
        fetchPosts();
      } else if (result.code === "UNAUTHORIZED" || result.status === 401) {
         alert(translations[lang].notice);
         window.open("https://yerin.duckdns.org/login", "_blank");
      }
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (post: Post) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/execute/GET_FANBOARD_DETAIL?contentId=${post.content_id}`);
      const data = await res.json();
      if (data.code === "SUCCESS" || data.status === "success") {
        setSelectedPost(data.data);
        setView("DETAIL");
      }
    } catch (err) {
      console.error("Detail error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Premium Feed Card Component
  const PostCard = ({ post }: { post: Post }) => {
    const typeLabel = bt[post.day_tag1 as keyof typeof bt] || post.day_tag1;
    const typeColor = post.day_tag1 === 'REPORT' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                      post.day_tag1 === 'LOST' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                      'bg-purple-500/10 text-purple-400 border-purple-500/20';

    const getImageUrl = (selectedTimesStr?: string) => {
      if (!selectedTimesStr) return null;
      try {
        const data = typeof selectedTimesStr === 'string' ? JSON.parse(selectedTimesStr) : selectedTimesStr;
        const key = data.imageKey || data.fileKey;
        if (!key) return null;
        return `/api/ai/interview/resume/view?fileKey=${encodeURIComponent(key)}`;
      } catch (e) {
        return null;
      }
    };

    const imageUrl = getImageUrl(post.selected_times);

    return (
      <div 
        onClick={() => openDetail(post)}
        className="group relative overflow-hidden bg-white/5 border border-white/10 rounded-2xl transition-all hover:bg-white/10 active:scale-[0.98] cursor-pointer"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-bts-gradient z-10" />
        
        {imageUrl && (
          <div className="w-full h-48 overflow-hidden relative">
            <img 
              src={imageUrl} 
              alt={post.title} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-dark/80 to-transparent" />
          </div>
        )}

        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${typeColor}`}>
              {typeLabel}
            </div>
            <span className="text-[10px] text-gray-500 flex items-center gap-1">
              <Clock size={10} /> {new Date(post.reg_dt).toLocaleDateString()}
            </span>
          </div>
          
          <h3 className="text-white font-bold mb-2 group-hover:text-bts-purple-light transition-colors line-clamp-1">
            {post.title}
          </h3>
          
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <div className="w-5 h-5 rounded-full bg-bts-gradient flex items-center justify-center text-[10px] text-white font-bold">
                {post.user_id ? post.user_id[0].toUpperCase() : 'A'}
              </div>
              <span>{post.user_id || 'ARMY'}</span>
            </div>
            {post.day_tag3 && (
              <div className="flex items-center gap-1 text-[11px] text-bts-purple-light font-medium">
                <MapPin size={10} /> {post.day_tag3}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {post.day_tag2?.split(/[\s,]+/).filter(Boolean).map((tag, i) => (
              <span key={i} className="text-[10px] text-bts-purple-light font-medium">
                #{tag.replace("#", "")}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (view === "WRITE" || view === "UPDATE") {
    return (
      <div className="flex flex-col h-full bg-bg-dark text-white overflow-y-auto">
        <div className="p-4 border-b border-white/5 flex items-center justify-between sticky top-0 bg-bg-dark/90 backdrop-blur-xl z-20">
          <button onClick={() => setView("LIST")} className="p-2 text-gray-400 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-bold text-lg">{view === "WRITE" ? translations[lang].write : translations[lang].update}</h2>
          <button 
            disabled={loading || !title.trim() || !content.trim()}
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2 bg-bts-purple text-white rounded-full font-bold text-sm disabled:opacity-50 shadow-lg shadow-bts-purple/20 transition-all hover:scale-105"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <><Send size={16} /> {translations[lang].submit}</>}
          </button>
        </div>

        <div className="p-5 space-y-6 max-w-2xl mx-auto w-full pb-20">
          {/* Post Type Selector */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{tt.category}</label>
            <div className="grid grid-cols-3 gap-2">
              {(["REPORT", "LOST", "CHEER"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => handlePostTypeChange(type)}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all flex flex-col items-center gap-2 ${
                    postType === type 
                    ? 'bg-bts-purple/20 border-bts-purple text-bts-purple-light' 
                    : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  {type === 'REPORT' ? <Megaphone size={18} /> : type === 'LOST' ? <Filter size={18} /> : <CheckCircle2 size={18} />}
                  {bt[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Title and Content */}
          <div className="space-y-4">
            <div className="space-y-2">
               <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{bf.title}</label>
               <input 
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-lg font-bold text-white outline-none focus:border-bts-purple transition-all placeholder:text-gray-600"
                placeholder={tt.placeholderTitle || bf.title}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
               <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{bf.content}</label>
               <textarea 
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-base text-gray-200 outline-none focus:border-bts-purple transition-all placeholder:text-gray-600 min-h-[300px] resize-none"
                placeholder={tt.placeholderContent || bf.content}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          </div>

          {/* Location and Tags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
               <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{bf.location}</label>
               <select 
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-bts-purple appearance-none"
                value={locationTag}
                onChange={(e) => setLocationTag(e.target.value)}
               >
                 <option value="" className="bg-white text-gray-900">선택 안 함</option>
                 {LOCATIONS.map(loc => <option key={loc} value={loc} className="bg-white text-gray-900">{loc}</option>)}
               </select>
            </div>
            <div className="space-y-2">
               <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{bf.tags}</label>
               <input 
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-bts-purple placeholder:text-gray-600"
                placeholder="#뷔 #아미 #보라해"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
              />
            </div>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{bf.image}</label>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUploading}
                className="w-24 h-24 rounded-2xl bg-white/5 border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-white hover:border-bts-purple transition-all"
              >
                {imageUploading ? <Loader2 className="animate-spin" /> : <Camera size={24} />}
                <span className="text-[10px] font-bold">PHOTO</span>
              </button>
              {imageFileKey && (
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-bts-purple">
                  <div className="absolute inset-0 bg-bts-purple/20 flex items-center justify-center">
                    <CheckCircle2 className="text-bts-purple-light" />
                  </div>
                  <button 
                    onClick={() => setImageFileKey(null)}
                    className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
          </div>
        </div>
      </div>
    );
  }

  if (view === "DETAIL" && selectedPost) {
    const typeLabel = bt[selectedPost.day_tag1 as keyof typeof bt] || selectedPost.day_tag1;

    return (
      <div className="flex flex-col h-full bg-bg-dark text-white overflow-y-auto">
        <div className="p-4 border-b border-white/5 flex items-center justify-between sticky top-0 bg-bg-dark/90 backdrop-blur-xl z-20">
          <button onClick={() => setView("LIST")} className="p-2 text-gray-400 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
             <button 
              onClick={() => {
                const text = `💜 BTS 광화문 현장 소식: ${selectedPost.title}\n${selectedPost.content?.slice(0, 50)}...`;
                const url = `https://bts-gwanghwamun.vercel.app?tab=board&id=${selectedPost.content_id}`;
                if (navigator.share) {
                  navigator.share({ title: selectedPost.title, text, url });
                } else {
                  navigator.clipboard.writeText(`${text}\n${url}`);
                  alert(translations[lang].copySuccess || "링크가 복사되었습니다!");
                }
              }}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
              title="공유하기"
             >
                <Share2 size={16} />
             </button>
             <button 
              onClick={() => {
                setTitle(selectedPost.title);
                setContent(selectedPost.content || "");
                setPostType((selectedPost.day_tag1 as any) || "REPORT");
                setHashtags(selectedPost.day_tag2 || "");
                setLocationTag(selectedPost.day_tag3 || "");
                setView("UPDATE");
              }} 
              className="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold transition-all"
             >
                {translations[lang].update}
             </button>
          </div>
        </div>

        <div className="p-6 max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-bts-gradient flex items-center justify-center text-lg font-bold">
              {selectedPost.user_id[0].toUpperCase()}
            </div>
            <div>
              <div className="font-bold flex items-center gap-2">
                {selectedPost.user_id}
                <span className="px-1.5 py-0.5 rounded bg-bts-purple/20 text-bts-purple-light text-[9px] border border-bts-purple/30">ARMY</span>
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1"><Clock size={10} /> {new Date(selectedPost.reg_dt).toLocaleString()}</span>
                {selectedPost.day_tag3 && <span className="flex items-center gap-1 text-bts-purple-light"><MapPin size={10} /> {selectedPost.day_tag3}</span>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="px-2 py-0.5 rounded-full inline-block text-[10px] font-bold border border-bts-purple/30 text-bts-purple-light bg-bts-purple/10">
              {typeLabel}
            </div>
            <h1 className="text-2xl font-bold leading-tight">{selectedPost.title}</h1>
            
            {(() => {
               const getImageUrl = (selectedTimesStr?: string) => {
                if (!selectedTimesStr) return null;
                try {
                  const data = typeof selectedTimesStr === 'string' ? JSON.parse(selectedTimesStr) : selectedTimesStr;
                  const key = data.imageKey || data.fileKey;
                  if (!key) return null;
                  return `/api/ai/interview/resume/view?fileKey=${encodeURIComponent(key)}`;
                } catch (e) { return null; }
              };
              const url = getImageUrl(selectedPost.selected_times);
              return url && (
                <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                   <img src={url} alt="Post image" className="w-full h-auto" />
                </div>
              );
            })()}

            <div className="text-gray-200 text-lg leading-relaxed whitespace-pre-wrap py-6">
              {selectedPost.content}
            </div>

            {selectedPost.day_tag2 && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                {selectedPost.day_tag2.split(/[\s,]+/).filter(Boolean).map((tag, i) => (
                  <span key={i} className="px-3 py-1 bg-bts-purple/10 text-bts-purple-light rounded-full text-xs font-medium border border-bts-purple/20">
                    #{tag.replace("#", "")}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-dark relative">
      {/* Premium Header */}
      <div className="sticky top-0 z-10 bg-bg-dark/80 backdrop-blur-md border-b border-white/5">
        <div className="p-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
               <MessageSquare size={22} className="text-bts-purple-light" />
               {translations[lang].board}
            </h2>
            <p className="text-[10px] text-gray-500 font-medium tracking-tight mt-0.5 uppercase">Connect with ARMYs worldwide</p>
          </div>
          <button 
            onClick={() => {
              resetForm();
              setView("WRITE");
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-bts-gradient text-white rounded-full font-bold text-sm hover:scale-105 transition-all shadow-lg shadow-bts-purple/20"
          >
            <Plus size={18} /> {translations[lang].write}
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex px-4 overflow-x-auto no-scrollbar pb-2">
          {(["ALL", "REPORT", "LOST", "CHEER"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-none px-4 py-2 text-sm font-bold transition-all relative ${
                activeTab === tab ? 'text-bts-purple-light' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {bt[tab]}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-bts-gradient rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto p-5 pb-24">
        {loading && posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <Loader2 className="animate-spin text-bts-purple-light mb-4" />
            <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Searching the universe...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10">
              <MessageSquare size={32} className="opacity-20" />
            </div>
            <p className="font-bold text-sm mb-1">{translations[lang].empty}</p>
            <p className="text-xs opacity-50">Be the first to share your light</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 animate-in fade-in duration-500">
            {posts.map((post) => (
              <PostCard key={post.content_id} post={post} />
            ))}
          </div>
        )}
      </div>

      {/* Floating Sparkle for active effect */}
      <div className="absolute bottom-8 right-8 w-24 h-24 bg-bts-purple/10 blur-3xl pointer-events-none" />
    </div>
  );
}
