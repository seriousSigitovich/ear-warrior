// The same row of links on every owner page, so any page reaches any other. The current page is shown, not linked.
export const ADMIN_PAGES: ReadonlyArray<readonly [href: string, title: string, what: string]> = [
  ['/admin/tunes', 'Мелодии', 'библиотека: список, загрузка звука, показ и скрытие'],
  ['/admin/challenges', 'Челленджи', 'ежедневные задания и их переопределения'],
  ['/admin/analytics', 'Аналитика', 'каждый пользователь: путь, практика, прогресс, где ушёл'],
  ['/admin/social', 'Соцсети', 'просмотры и подписчики YouTube и Instagram'],
];

export function adminNav(current?: string): string {
  const links = ADMIN_PAGES.map(([href, title]) => (href === current ? `<b>${title}</b>` : `<a href="${href}">${title}</a>`));
  return `<nav class="controls"><a href="/admin">☰ Меню</a>${links.join('')}</nav>`;
}
