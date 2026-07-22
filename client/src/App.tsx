import { Route, Switch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

import Home from "@/pages/Home";
import Matches from "@/pages/Matches";
import MatchDetail from "@/pages/MatchDetail";
import Bots from "@/pages/Bots";
import AnalystProfile from "@/pages/AnalystProfile";
import Exchange from "@/pages/Exchange";
import MyPage from "@/pages/MyPage";

import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminSports from "@/pages/admin/AdminSports";
import AdminMatches from "@/pages/admin/AdminMatches";
import AdminBots from "@/pages/admin/AdminBots";
import AdminSettle from "@/pages/admin/AdminSettle";
import AdminExchange from "@/pages/admin/AdminExchange";
import AdminUsers from "@/pages/admin/AdminUsers";

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="p-20 text-center text-muted-foreground">로딩 중...</div>;
  if (!isAdmin) return <div className="p-20 text-center text-muted-foreground">관리자만 접근 가능합니다.</div>;
  return (
    <AdminLayout>
      <Component />
    </AdminLayout>
  );
}

export default function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/matches" component={Matches} />
      <Route path="/matches/:id" component={MatchDetail} />
      <Route path="/bots" component={Bots} />
      <Route path="/analyst/:id" component={AnalystProfile} />
      <Route path="/exchange" component={Exchange} />
      <Route path="/mypage" component={MyPage} />

      <Route path="/admin" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/sports" component={() => <AdminRoute component={AdminSports} />} />
      <Route path="/admin/matches" component={() => <AdminRoute component={AdminMatches} />} />
      <Route path="/admin/bots" component={() => <AdminRoute component={AdminBots} />} />
      <Route path="/admin/settle" component={() => <AdminRoute component={AdminSettle} />} />
      <Route path="/admin/exchange" component={() => <AdminRoute component={AdminExchange} />} />
      <Route path="/admin/users" component={() => <AdminRoute component={AdminUsers} />} />

      <Route>
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">페이지를 찾을 수 없습니다.</div>
      </Route>
    </Switch>
  );
}
