import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Megaphone, FileText, Trash2 } from "lucide-react";

export default function AdminSettings() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.getAdSettings.useQuery();
  const [form, setForm] = useState({ bannerEnabled: true, interstitialEnabled: true, cooldownSec: 300, maxPerHour: 6 });

  useEffect(() => { if (data) setForm(data); }, [data]);

  const update = trpc.admin.updateAdSettings.useMutation({
    onSuccess: () => { toast.success("광고 설정 저장 완료"); utils.admin.getAdSettings.invalidate(); utils.settings.adConfig.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  // 분석글(AI 글) 생성 정책 — 테스트 종료 후 "이 날짜 이후 경기만 생성"으로 전환
  const { data: policy } = trpc.admin.getGenerationPolicy.useQuery();
  const [startDate, setStartDate] = useState("");
  useEffect(() => { if (policy) setStartDate(policy.startDate); }, [policy]);
  const updatePolicy = trpc.admin.updateGenerationPolicy.useMutation({
    onSuccess: () => { toast.success("분석글 생성 정책 저장 완료"); utils.admin.getGenerationPolicy.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const cleanupAnalyses = trpc.admin.cleanupOldAnalyses.useMutation({
    onSuccess: (r) => { toast.success(`과거 분석글 ${r.deleted}건 삭제 완료 (경기 자체와 상세데이터는 유지됨)`); utils.match.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const wipeAll = trpc.admin.wipeAllAnalyses.useMutation({
    onSuccess: (r) => { toast.success(`전체 초기화 완료 — 분석글 ${r.deletedAnalyses}건, 픽 ${r.deletedPicks}건 삭제됨`); utils.match.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">로딩 중...</div>;

  return (
    <div>
      <h1 className="text-2xl font-black mb-2 flex items-center gap-2"><Megaphone className="w-6 h-6" />광고 설정</h1>
      <p className="text-sm text-muted-foreground mb-6">여기서 끄면 사이트 전체에서 즉시 광고가 사라집니다 (결제 없이 순수 무료 운영도 가능).</p>

      <div className="max-w-lg space-y-4">
        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">배너 광고</p>
            <p className="text-xs text-muted-foreground mt-0.5">메인 페이지 등에 노출되는 일반 배너 광고</p>
          </div>
          <Switch checked={form.bannerEnabled} onCheckedChange={(v) => setForm({ ...form, bannerEnabled: v })} />
        </div>

        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">전면광고 (이탈 시)</p>
            <p className="text-xs text-muted-foreground mt-0.5">경기 상세 페이지에서 나갈 때 노출되는 전면광고</p>
          </div>
          <Switch checked={form.interstitialEnabled} onCheckedChange={(v) => setForm({ ...form, interstitialEnabled: v })} />
        </div>

        {form.interstitialEnabled && (
          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <p className="font-medium text-sm">전면광고 빈도 제한</p>
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs text-muted-foreground shrink-0">재노출 쿨다운(초)</label>
              <Input type="number" className="w-28 h-8 text-sm" value={form.cooldownSec} onChange={(e) => setForm({ ...form, cooldownSec: Number(e.target.value) })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs text-muted-foreground shrink-0">시간당 최대 노출 횟수</label>
              <Input type="number" className="w-28 h-8 text-sm" value={form.maxPerHour} onChange={(e) => setForm({ ...form, maxPerHour: Number(e.target.value) })} />
            </div>
          </div>
        )}

        <Button className="w-full gold-gradient text-black font-bold" onClick={() => update.mutate(form)} disabled={update.isPending}>
          {update.isPending ? "저장 중..." : "저장"}
        </Button>

        {!form.bannerEnabled && !form.interstitialEnabled && (
          <p className="text-xs text-center text-muted-foreground">
            현재 모든 광고가 꺼져있습니다 — 완전 무료로 운영 중입니다.
          </p>
        )}
      </div>

      <h2 className="text-xl font-black mt-10 mb-2 flex items-center gap-2"><FileText className="w-5 h-5" />분석글 생성 정책</h2>
      <p className="text-sm text-muted-foreground mb-4">테스트가 끝나고 실제 운영을 시작하실 때, 특정 날짜부터의 경기에만 분석글이 생성되도록 제한할 수 있습니다. 그 이전 경기는 상세데이터(라인업·부상자·배당률·상대전적)만 저장되고 AI 분석글은 생성되지 않습니다.</p>
      <div className="max-w-lg space-y-3">
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <label className="text-sm font-medium">분석글 생성 시작일</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
          <p className="text-xs text-muted-foreground">비워두면 테스트모드(모든 경기 생성 허용)입니다.</p>
          <Button className="w-full" variant="outline" onClick={() => updatePolicy.mutate({ startDate })} disabled={updatePolicy.isPending}>
            {updatePolicy.isPending ? "저장 중..." : "정책 저장"}
          </Button>
        </div>

        <div className="p-4 rounded-xl bg-card border border-destructive/30 space-y-2">
          <p className="text-sm font-medium text-destructive">기존 과거 분석글 일괄 삭제</p>
          <p className="text-xs text-muted-foreground">위에서 지정한 시작일 이전 경기에 이미 만들어진 분석글(봇 글)만 삭제합니다. 경기 목록과 상세데이터(라인업 등)는 그대로 남습니다.</p>
          <Button
            variant="outline" className="w-full text-destructive border-destructive/30"
            onClick={() => { if (startDate && confirm(`${startDate} 이전 경기의 분석글을 전부 삭제합니다. 계속할까요?`)) cleanupAnalyses.mutate({ beforeDate: startDate }); else if (!startDate) toast.error("먼저 시작일을 지정하고 저장해주세요."); }}
            disabled={cleanupAnalyses.isPending}
          >
            <Trash2 className="w-4 h-4 mr-1" />과거 분석글 삭제
          </Button>
        </div>

        <div className="p-4 rounded-xl bg-card border border-destructive/50 space-y-2 mt-3">
          <p className="text-sm font-medium text-destructive">전체 분석글·픽 완전 초기화 (테스트 재시작용)</p>
          <p className="text-xs text-muted-foreground">날짜와 무관하게 지금까지 생성된 모든 분석글·픽을 삭제합니다. 경기 일정·라인업·부상자 등 상세데이터는 그대로 유지되며, 다시 "분석글 생성"을 누르면 최신 로직으로 새로 만들어집니다.</p>
          <Button
            variant="outline" className="w-full text-destructive border-destructive/50"
            onClick={() => { if (confirm("정말로 지금까지 생성된 모든 분석글과 픽을 삭제하시겠습니까? 되돌릴 수 없습니다.")) wipeAll.mutate(); }}
            disabled={wipeAll.isPending}
          >
            <Trash2 className="w-4 h-4 mr-1" />{wipeAll.isPending ? "초기화 중..." : "전체 분석글·픽 완전 삭제"}
          </Button>
        </div>
      </div>
    </div>
  );
}
