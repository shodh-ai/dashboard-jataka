import ReplayPlayer from "../components/ReplayPlayer";
import { Suspense } from 'react';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// ReplayPage.tsx
export default async function ReplayPage(props: Props) {
  const searchParams = await props.searchParams;
  const eventsUrl = typeof searchParams.data === 'string' ? searchParams.data : '';

  if (!eventsUrl) {
    return <div className="text-white p-10">No Replay Data</div>;
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <div className="mx-auto w-full max-w-screen-2xl md:px-8">
        <h1 className="text-2xl font-bold text-white mb-3 mt-3 text-center">
          Session Replay
        </h1>

        <Suspense fallback={<div className="text-white text-center">Loading Player...</div>}>
          <ReplayPlayer eventsUrl={eventsUrl} />
        </Suspense>
      </div>
    </div>
  );
}
