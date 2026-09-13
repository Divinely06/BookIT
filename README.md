# Cardinal Resource Hub

Cardinal Resource Hub is a Mapúa University facility and equipment reservation system for organizations, faculty reviewers, maintenance staff, administrators, and the Dean.

## Repository Layout

```text
src/                 Active React application and shared styles
public/              Runtime assets, including the Mapúa logo
database/            Neon/PostgreSQL schema reference
README.md            Product, workflow, and database documentation
vite.config.ts       Vite development and production configuration
```

## Approval Flow

`Organization submission → Faculty review → Maintenance handling → Admin review → Dean final decision → Approved`

The Dean is the final authority for budget, policy, and campus-rule decisions. Admin manages the resources and performs the operational review immediately before the Dean's decision.

### Existing Neon databases

After deploying the booking workflow changes, run [database/migrations/001_booking_workflow.sql](database/migrations/001_booking_workflow.sql) once against the existing Neon database. It adds the idempotency key and document content type without removing existing bookings or files. Fresh databases should use [database/schema.sql](database/schema.sql).

For local development, set `DATABASE_URL` in `.env`, then run the API and website in separate terminals:

```bash
npm run api
npm run dev -- --host 0.0.0.0 --port 5173
```

Open `http://localhost:5173`. The Vite server proxies `/api` requests to the API on port `3001`. Existing databases should also run [database/migrations/002_date_aware_availability.sql](database/migrations/002_date_aware_availability.sql) to prevent overlapping non-rejected room requests.

## In-app notifications

Run [database/migrations/003_in_app_notifications.sql](database/migrations/003_in_app_notifications.sql) once against an existing database. New requests and workflow changes appear in the notification bell for the organization and the next responsible role. Rejections include the reviewer’s reason.

## ERD Database Design

The following relational design is intended for Neon PostgreSQL. The executable reference schema is in [database/schema.sql](database/schema.sql).

```mermaid
erDiagram
		APP_USER ||--o{ STUDENT_ORGANIZATION : advises
		APP_USER ||--o{ BOOKING : requests
		APP_USER ||--o{ APPROVAL : performs
		STUDENT_ORGANIZATION ||--o{ BOOKING : submits
		ROOM ||--o{ BOOKING : reserves
		BOOKING ||--o{ BOOKING_EQUIPMENT : needs
		EQUIPMENT ||--o{ BOOKING_EQUIPMENT : included_in
		BOOKING ||--o{ DOCUMENT : includes
		BOOKING ||--o{ APPROVAL : has

		APP_USER {
			int user_id PK
			string full_name
			string email UK
			string password_hash
			string role "organization | faculty | maintenance | admin | dean"
			string contact_number
		}
		STUDENT_ORGANIZATION {
			int org_id PK
			string org_name UK
			int faculty_adviser_id FK
			string contact_email
			string status
		}
		ROOM {
			int room_id PK
			string room_name
			string location
			int capacity
			string availability_status
		}
		EQUIPMENT {
			int equipment_id PK
			string equipment_name
			string category
			int quantity_available
			string status
		}
		BOOKING {
			int booking_id PK
			int org_id FK
			int room_id FK
			int requested_by_user_id FK
			datetime date_requested
			date event_date
			time start_time
			time end_time
			string purpose
			string status "Faculty review | Maintenance review | Admin review | Dean review | Approved | Prepared | Rejected"
		}
		BOOKING_EQUIPMENT {
			int booking_id PK, FK
			int equipment_id PK, FK
			int quantity_requested
		}
		DOCUMENT {
			int document_id PK
			int booking_id FK
			string file_name
			string file_path
			datetime upload_date
			string signature_status
		}
		APPROVAL {
			int approval_id PK
			int booking_id FK
			int approved_user_id FK
			int approval_level "1 Faculty, 2 Maintenance, 3 Admin, 4 Dean"
			string status
			datetime date_actioned
			string remarks
		}
```

### Role Responsibilities

| Role | Responsibility | Database authority |
| --- | --- | --- |
| Organization | Owns its account, submits event requests, and tracks bookings | Creates `BOOKING`, `DOCUMENT`, and `BOOKING_EQUIPMENT` records |
| Faculty | Reviews the organization submission and adviser documents | Creates level 1 `APPROVAL` records |
| Maintenance | Checks equipment and setup after faculty approval | Creates level 2 `APPROVAL` records and updates readiness |
| Admin | Manages rooms, equipment, organizations, and operational review | Creates level 3 `APPROVAL` records |
| Dean | Makes the final decision on budget, policy, and campus rules | Creates level 4 `APPROVAL` records and moves the booking to `Approved` or `Rejected` |