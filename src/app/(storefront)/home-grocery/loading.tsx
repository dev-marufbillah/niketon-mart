/** Skeleton that mirrors the shop layout while the catalogue resolves. */
export default function ShopLoading() {
  return (
    <>
      <div className="grocery-pattern border-b border-line bg-surface-2">
        <div className="container-page flex flex-col items-center py-12">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-white/80" />
          <div className="mt-3 h-3 w-40 animate-pulse rounded-full bg-white/70" />
        </div>
      </div>

      <div className="container-page py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
          <div className="hidden space-y-6 lg:block">
            {Array.from({ length: 5 }).map((_, group) => (
              <div key={group} className="space-y-2.5 border-t border-line pt-5 first:border-0 first:pt-0">
                <div className="h-4 w-24 animate-pulse rounded bg-surface" />
                {Array.from({ length: 4 }).map((__, row) => (
                  <div key={row} className="h-3.5 w-full animate-pulse rounded bg-surface" />
                ))}
              </div>
            ))}
          </div>

          <div>
            <div className="mb-5 flex items-center justify-between">
              <div className="h-4 w-48 animate-pulse rounded bg-surface" />
              <div className="h-10 w-40 animate-pulse rounded-full bg-surface" />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-2xl bg-white ring-1 ring-line"
                >
                  <div className="aspect-[4/3] animate-pulse bg-surface" />
                  <div className="space-y-2.5 p-4">
                    <div className="h-3 w-20 animate-pulse rounded bg-surface" />
                    <div className="h-4 w-32 animate-pulse rounded bg-surface" />
                    <div className="h-3 w-16 animate-pulse rounded bg-surface" />
                    <div className="flex items-center justify-between pt-2">
                      <div className="h-4 w-16 animate-pulse rounded bg-surface" />
                      <div className="h-8 w-20 animate-pulse rounded-full bg-surface" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
