import { redirect } from 'next/navigation';

export default function B2BOrdersRedirect() {
  redirect('/vendor/procurement?tab=active_pos');
}
