import { createHashRouter, Navigate } from "react-router-dom"
import { lazy, Suspense } from "react"
import Layout from "@/pages/_layout"

const Dashboard = lazy(() => import("@/pages/dashboard"))
const TestCases = lazy(() => import("@/pages/test-cases"))
const Executions = lazy(() => import("@/pages/executions"))
const Defects = lazy(() => import("@/pages/defects"))
const NotFound  = lazy(() => import("@/pages/not-found"))

// IMPORTANT: Do not remove or modify the code below!
// Normalize URL when hosted in Power Apps (remove trailing index.html)
if (location.pathname.endsWith("/index.html")) {
  const base = new URL(".", location.href).pathname;
  history.replaceState(null, "", base + location.search + location.hash);
}

export const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      // 業務ページを追加したら、config.ts の NAV_SECTIONS と同じ path でここにも登録する
      { path: "dashboard", element: <Suspense fallback={null}><Dashboard /></Suspense> },
      { path: "test-cases", element: <Suspense fallback={null}><TestCases /></Suspense> },
      { path: "executions", element: <Suspense fallback={null}><Executions /></Suspense> },
      { path: "defects", element: <Suspense fallback={null}><Defects /></Suspense> },
      { path: "*",         element: <Suspense fallback={null}><NotFound /></Suspense>  },
    ],
  },
])
