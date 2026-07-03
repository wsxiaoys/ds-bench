import os
import re
import json
import time
from apideck_unify import Apideck

def main():
    # 1. Read environment variables and run-id
    api_key = os.environ.get("APIDECK_API_KEY")
    app_id = os.environ.get("APIDECK_APP_ID")
    consumer_id = os.environ.get("APIDECK_CONSUMER_ID")
    collection_id = os.environ.get("APIDECK_ISSUE_TRACKING_COLLECTION_ID")
    
    with open("/logs/artifacts/run-id", "r") as f:
        run_id = f.read().strip()
        
    print(f"Run ID: {run_id}")
    print(f"Collection ID: {collection_id}")
    
    # 2. Instantiate Apideck SDK
    sdk = Apideck(
        api_key=api_key,
        app_id=app_id,
        consumer_id=consumer_id
    )
    
    # 3. Seed exactly 5 tickets
    seeded_ticket_ids = {}
    for i in range(1, 6):
        subject = f"Pagination demo {i} - {run_id}"
        description = f"Seeded by list_tickets_pagination_py for run {run_id}"
        print(f"Seeding ticket {i}: {subject}")
        
        # Call the SDK to create a ticket
        res = sdk.issue_tracking.collection_tickets.create(
            collection_id=collection_id,
            service_id="github",
            subject=subject,
            description=description
        )
        
        ticket_id = res.create_ticket_response.data.id
        print(f"Created ticket {i} with ID: {ticket_id}")
        seeded_ticket_ids[i] = ticket_id
        
        # Add a small delay to respect rate limits/ensure ordering/etc.
        time.sleep(1)
        
    # 4. List tickets page-by-page with limit=2
    print("Listing tickets page-by-page...")
    page_count = 0
    all_tickets = []
    
    # First page
    current_page = sdk.issue_tracking.collection_tickets.list(
        collection_id=collection_id,
        service_id="github",
        limit=2
    )
    
    if current_page:
        page_count += 1
        if current_page.get_tickets_response and current_page.get_tickets_response.data:
            all_tickets.extend(current_page.get_tickets_response.data)
            print(f"Page {page_count}: retrieved {len(current_page.get_tickets_response.data)} tickets")
            
        while True:
            if current_page.next:
                # Get next page
                next_page = current_page.next()
                if next_page is None:
                    break
                current_page = next_page
                page_count += 1
                if current_page.get_tickets_response and current_page.get_tickets_response.data:
                    all_tickets.extend(current_page.get_tickets_response.data)
                    print(f"Page {page_count}: retrieved {len(current_page.get_tickets_response.data)} tickets")
            else:
                break
                
    print(f"Total pages traversed: {page_count}")
    print(f"Total tickets retrieved: {len(all_tickets)}")
    
    # 5. Filter and construct the JSON artifact
    tickets_list = []
    seen_indices = set()
    for ticket in all_tickets:
        if ticket.id in seeded_ticket_ids.values():
            match = re.search(r"Pagination demo (\d+)", ticket.subject)
            if match:
                index = int(match.group(1))
                if index not in seen_indices:
                    seen_indices.add(index)
                    tickets_list.append({
                        "index": index,
                        "id": ticket.id,
                        "subject": ticket.subject
                    })
                
    # Sort by index ascending
    tickets_list.sort(key=lambda t: t["index"])
    
    # Validate we got exactly 5 tickets
    print(f"Filtered {len(tickets_list)} tickets for run {run_id}")
    for t in tickets_list:
        print(f"Index {t['index']}: ID {t['id']}, Subject: {t['subject']}")
        
    # Construct final shape
    output_data = {
        "run_id": run_id,
        "collection_id": collection_id,
        "page_count": page_count,
        "tickets": tickets_list
    }
    
    os.makedirs("/home/user/myproject", exist_ok=True)
    output_path = "/home/user/myproject/tickets.json"
    with open(output_path, "w") as f:
        json.dump(output_data, f, indent=2)
        
    print(f"Wrote JSON artifact to {output_path}")

if __name__ == "__main__":
    main()
