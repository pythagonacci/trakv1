create or replace function public.enforce_paid_workspace_seat_limits()
returns trigger
language plpgsql
as $$
declare
  billing_row public.workspace_billing%rowtype;
  active_member_count integer;
begin
  select *
  into billing_row
  from public.workspace_billing
  where workspace_id = new.workspace_id;

  if billing_row.id is null then
    return new;
  end if;

  if billing_row.plan_key = 'free' then
    return new;
  end if;

  if billing_row.billing_status not in ('trialing', 'active', 'past_due', 'incomplete') then
    return new;
  end if;

  select count(*)
  into active_member_count
  from public.workspace_members
  where workspace_id = new.workspace_id;

  if active_member_count >= greatest(coalesce(billing_row.seat_quantity, 1), 1) then
    raise exception
      'This workspace has % purchased seats and already includes % active members. Increase seats before adding another member.',
      billing_row.seat_quantity,
      active_member_count;
  end if;

  return new;
end;
$$;

drop trigger if exists workspace_members_enforce_paid_seat_limits on public.workspace_members;

create trigger workspace_members_enforce_paid_seat_limits
before insert on public.workspace_members
for each row
execute function public.enforce_paid_workspace_seat_limits();
