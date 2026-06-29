# CondoTracker

App per **amministratori di condominio**: gestione di condomini, unità abitative e
condòmini; registrazione spese con **distribuzione automatica per millesimi**;
notifiche email ai condòmini con **promemoria scalari**; pagamento tramite dati
bonifico precompilati e **QR code SEPA (EPC)**.

> Costruita riusando l'infrastruttura di [BillTracker](../BillTracker): autenticazione
> Supabase, parsing documenti con Claude, notifiche Resend, modalità scura, PWA.
> **CondoTracker non incassa né fa transitare denaro**: mostra solo i dati per il
> bonifico e genera il QR code che il condòmino esegue dalla propria banca.

## Stack

- **Next.js 14** (App Router, Server Actions) + **TypeScript** + **Tailwind**
- **Supabase** (Auth, Postgres con RLS, Storage)
- **Anthropic Claude** per l'estrazione dati dai documenti giustificativi (opzionale)
- **Resend** per le email (opzionale)
- **qrcode** per il QR code SEPA (EPC QR)

## Modello dati

```
profiles (utenti auth)
buildings (condomini)         ── admin_id → profiles, invite_code, iban
  └─ millesimi_tables         ── tabelle millesimali (es. "Generale", "Scale")
  └─ units (unità)            ── building_id
       └─ unit_shares         ── (table_id, unit_id) → millesimi
       └─ residents (condòmini) ── unit_id, email, user_id?, status
  └─ expenses (spese)         ── building_id, table_id, amount totale, status
       └─ charges (quote)     ── expense_id, unit_id, amount, status pagamento
```

## Setup

1. **Crea un nuovo progetto Supabase** e applica `supabase/migrations/0001_init.sql`
   (SQL Editor → incolla → Run). Crea anche il bucket privato `documents`
   (la migration lo fa già).
2. Copia `.env.example` in `.env.local` e compila le chiavi Supabase
   (URL, anon key, service-role key). Le altre chiavi sono opzionali:
   - senza `ANTHROPIC_API_KEY` → registrazione spesa con inserimento manuale;
   - senza `RESEND_API_KEY` → email loggate ma non inviate;
   - `CRON_SECRET` serve solo in produzione per proteggere il job promemoria.
3. Installa ed avvia:
   ```bash
   npm install
   npm run dev
   ```

## Comandi

```bash
npm run dev        # sviluppo
npm run build      # build di produzione
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

## Flussi principali

- **Amministratore**: crea condomini → definisce unità con millesimi → aggiunge
  condòmini (manuale o con codice invito) → registra spese (con documento) →
  rivede le quote calcolate → conferma e invia le notifiche.
- **Condòmino**: si registra col codice invito (conferma dell'admin) → vede le
  quote dovute → "Paga con bonifico" (dati precompilati + QR SEPA) → segna come
  pagata → l'admin conferma l'incasso.
