import type { Href } from 'expo-router';

export function gigHref(taskId: string): Href {
  return { pathname: '/gig/[taskId]', params: { taskId } } as Href;
}
