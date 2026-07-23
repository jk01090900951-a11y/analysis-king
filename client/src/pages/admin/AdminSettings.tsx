import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Megaphone } from "lucide-react";

export default function AdminSettings() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.getAdSettings.useQuery();
  const [form, setForm] = useState({ bannerEnabled: true, interstitialEnabled: true, cooldownSec: 300, maxPerHour: 6 });

  useEffect(() => { if (data) setForm(data); }, [data]);

  const update = trpc.admin.updateAdSettings.useMutation({
    onSuccess: () => { toast.success("광고 설정 저장 완료"); utils.admin.getAdSettings.invalidate(); utils.settings.adConfig.invalidate(); },
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
    </div>
  );
}
