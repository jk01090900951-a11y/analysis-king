import { Route, Switch } from "wouter";

import Home from "@/pages/Home";
import Matches from "@/pages/Matches";
import MatchDetail from "@/pages/MatchDetail";
import Bots from "@/pages/Bots";
import AnalystProfile from "@/pages/AnalystProfile";

import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminSports from "@/pages/admin/AdminSports";
import AdminMatches from "@/pages/admin/AdminMatches";
import AdminBots from "@/pages/admin/AdminBots";
import AdminSettle from "@/pages/admin/AdminSettle";
import AdminUsers from "@/pages/admin/AdminUsers";

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  // AdminLayout이 로딩/미인증(로그인폼) 상태를 자체적으로 처리합니다.
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

      <Route path="/admin" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/sports" component={() => <AdminRoute component={AdminSports} />} />
      <Route path="/admin/matches" component={() => <AdminRoute component={AdminMatches} />} />
      <Route path="/admin/bots" component={() => <AdminRoute component={AdminBots} />} />
      <Route path="/admin/settle" component={() => <AdminRoute component={AdminSettle} />} />
      <Route path="/admin/users" component={() => <AdminRoute component={AdminUsers} />} />

      <Route>
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">페이지를 찾을 수 없습니다.</div>
      </Route>
    </Switch>
  );
}
