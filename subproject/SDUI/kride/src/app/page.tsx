import { redirect } from "next/navigation";

// 루트는 로그인 없이 볼 수 있는 K-POP 데모로 보낸다.
// /browse는 미들웨어가 /login으로 보내는데 kride 웹에는 로그인 페이지가 없어 404가 된다.
export default function HomePage() {
  redirect("/kpop");
}
