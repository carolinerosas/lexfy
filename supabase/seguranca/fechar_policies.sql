-- Fecha o acesso público: RLS continua ligado e sem policies => só a chave secreta acessa.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where (schemaname = 'public' and policyname like 'justio\_%')
              or (schemaname = 'storage' and tablename = 'objects' and policyname like 'justio\_documentos\_%')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
