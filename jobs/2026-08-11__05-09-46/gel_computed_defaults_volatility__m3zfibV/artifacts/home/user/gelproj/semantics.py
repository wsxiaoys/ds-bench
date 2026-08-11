import asyncio
import datetime
import json
import uuid
import gel

async def build_report() -> dict:
    client = gel.create_async_client()
    try:
        # Step 1: Clean up database
        await client.execute("delete Batch;")
        await client.execute("delete Certificate;")
        await client.execute("delete Measurement;")
        await client.execute("delete Sample;")

        # Step 2: Insert four samples in a single statement
        # Alpha-01/1.5, Bravo-02/2.25, Charlie-03/3.0, Delta-04/4.75
        await client.execute("""
            for data in {
                (label := 'Alpha-01', grams := 1.5),
                (label := 'Bravo-02', grams := 2.25),
                (label := 'Charlie-03', grams := 3.0),
                (label := 'Delta-04', grams := 4.75)
            } union (
                insert Sample {
                    label := data.label,
                    grams := data.grams
                }
            );
        """)

        # Step 3: Insert Echo-05 in a later, separate statement
        await client.execute("""
            insert Sample {
                label := 'Echo-05',
                grams := 5.5
            };
        """)

        # Step 4: Query Alpha-01's counts and total_value before measurements are inserted
        alpha_before = await client.query_single("""
            select Sample {
                assay_count,
                measurement_count,
                total_value
            } filter .label = 'Alpha-01';
        """)
        alpha_assay_count_before = alpha_before.assay_count
        alpha_measurement_count_before = alpha_before.measurement_count
        alpha_total_value_before = alpha_before.total_value

        # Step 5: Query Delta-04's label_key and intake info before update
        delta_before = await client.query_single("""
            select Sample {
                label_key,
                intake_ref,
                intake_at
            } filter .label = 'Delta-04';
        """)
        label_key_before_update = delta_before.label_key
        intake_ref_before = delta_before.intake_ref
        intake_at_before = delta_before.intake_at

        # Step 6: Insert Assays
        # A1/Alpha-01/10.0, A2/Alpha-01/2.5, A3/Bravo-02/7.25
        await client.execute("""
            insert Assay {
                code := 'A1',
                sample := (select Sample filter .label = 'Alpha-01'),
                value := 10.0
            };
        """)
        await client.execute("""
            insert Assay {
                code := 'A2',
                sample := (select Sample filter .label = 'Alpha-01'),
                value := 2.5
            };
        """)
        await client.execute("""
            insert Assay {
                code := 'A3',
                sample := (select Sample filter .label = 'Bravo-02'),
                value := 7.25
            };
        """)

        # Step 7: Insert Calibrations
        # C1/Alpha-01/0.5, C2/Charlie-03/-1.25
        await client.execute("""
            insert Calibration {
                code := 'C1',
                sample := (select Sample filter .label = 'Alpha-01'),
                bias := 0.5
            };
        """)
        await client.execute("""
            insert Calibration {
                code := 'C2',
                sample := (select Sample filter .label = 'Charlie-03'),
                bias := -1.25
            };
        """)

        # Step 8: Insert Certificate
        # serial CERT-ALPHA for Alpha-01
        await client.execute("""
            insert Certificate {
                serial := 'CERT-ALPHA',
                sample := (select Sample filter .label = 'Alpha-01')
            };
        """)

        # Step 9: Insert Batch
        # BATCH-1, linked to Alpha-01 (position 1), Bravo-02 (2), Charlie-03 (3)
        await client.execute("""
            insert Batch {
                code := 'BATCH-1',
                samples := (
                    select Sample {
                        @position := (
                            if .label = 'Alpha-01' then 1
                            else if .label = 'Bravo-02' then 2
                            else if .label = 'Charlie-03' then 3
                            else 0
                        )
                    } filter .label in {'Alpha-01', 'Bravo-02', 'Charlie-03'}
                )
            };
        """)

        # Step 10: Query Alpha-01's counts and total_value after measurements are inserted
        alpha_after = await client.query_single("""
            select Sample {
                assay_count,
                measurement_count,
                total_value
            } filter .label = 'Alpha-01';
        """)
        alpha_assay_count_after = alpha_after.assay_count
        alpha_measurement_count_after = alpha_after.measurement_count
        alpha_total_value_after = alpha_after.total_value

        # Step 11: Update Delta-04 to Zulu-99 and grams 9.0
        await client.execute("""
            update Sample filter .label = 'Delta-04' set {
                label := 'Zulu-99',
                grams := 9.0
            };
        """)

        # Step 12: Query Zulu-99's label_key and intake info after update
        zulu_after = await client.query_single("""
            select Sample {
                label_key,
                intake_ref,
                intake_at
            } filter .label = 'Zulu-99';
        """)
        label_key_after_update = zulu_after.label_key
        intake_ref_after = zulu_after.intake_ref
        intake_at_after = zulu_after.intake_at

        # Step 13: Compute defaults booleans
        intake_at_unchanged_after_update = (intake_at_before == intake_at_after)
        intake_ref_unchanged_after_update = (intake_ref_before == intake_ref_after)

        # Query Echo-05 intake_at
        echo_intake_at = await client.query_single("""
            select (select Sample filter .label = 'Echo-05').intake_at;
        """)
        # Query Alpha-01 intake_at
        alpha_intake_at = await client.query_single("""
            select (select Sample filter .label = 'Alpha-01').intake_at;
        """)
        late_intake_at_not_before_batch = (echo_intake_at >= alpha_intake_at)

        # Batch insert size, distinct intake_at, distinct intake_ref
        batch_insert_size = await client.query_single("""
            select count((select Sample filter .label in {'Alpha-01', 'Bravo-02', 'Charlie-03', 'Zulu-99'}));
        """)
        distinct_intake_at_in_batch = await client.query_single("""
            select count(distinct (select Sample filter .label in {'Alpha-01', 'Bravo-02', 'Charlie-03', 'Zulu-99'}).intake_at);
        """)
        distinct_intake_ref_in_batch = await client.query_single("""
            select count(distinct (select Sample filter .label in {'Alpha-01', 'Bravo-02', 'Charlie-03', 'Zulu-99'}).intake_ref);
        """)

        # Step 14: Try read-only update of intake_at
        readonly_rejected = False
        readonly_error_class = ""
        readonly_error_message = ""
        try:
            await client.execute("""
                update Sample filter .label = 'Alpha-01' set {
                    intake_at := datetime_current()
                };
            """)
        except Exception as e:
            readonly_rejected = True
            readonly_error_class = type(e).__name__
            readonly_error_message = str(e)

        # Step 15: Age non-negative check
        ages_objs = await client.query("select Sample.age;")
        age_non_negative = all(age.total_seconds() >= 0 for age in ages_objs)

        # Step 16: Age difference matches intake difference
        age_difference_matches_intake_difference = await client.query_single("""
            with
                alpha := (select Sample filter .label = 'Alpha-01'),
                echo := (select Sample filter .label = 'Echo-05'),
                age_diff := alpha.age - echo.age,
                intake_diff := echo.intake_at - alpha.intake_at
            select age_diff = intake_diff;
        """)

        # Step 17: Volatility probes
        # Probe 1: schema_computed_volatile
        # We run this using the gel CLI to allow session configuration/DDL capabilities
        schema_computed_volatile_rejected = False
        schema_computed_volatile_error_class = ""
        schema_computed_volatile_error_message = ""
        try:
            proc = await asyncio.create_subprocess_exec(
                'gel', 'query',
                'configure session set allow_bare_ddl := \'AlwaysAllow\'; alter type Sample create property volatile_computed := uuid_generate_v4();',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                schema_computed_volatile_rejected = True
                err_msg = stderr.decode().strip()
                schema_computed_volatile_error_message = err_msg
                schema_computed_volatile_error_class = "SchemaDefinitionError"
                if "error: " in err_msg:
                    first_line = err_msg.split('\n')[0]
                    parts = first_line.split(':')
                    if len(parts) >= 2:
                        schema_computed_volatile_error_class = parts[1].strip()
        except Exception as e:
            schema_computed_volatile_rejected = True
            schema_computed_volatile_error_class = type(e).__name__
            schema_computed_volatile_error_message = str(e)

        # Probe 2: cartesian_volatile
        cartesian_volatile_rejected = False
        cartesian_volatile_error_class = ""
        cartesian_volatile_error_message = ""
        try:
            await client.execute("select {1, 2} * random();")
        except Exception as e:
            cartesian_volatile_rejected = True
            cartesian_volatile_error_class = type(e).__name__
            cartesian_volatile_error_message = str(e)

        # Verify schema is unchanged
        types_after = await client.query("""
            select schema::ObjectType { name } filter .name like 'default::%';
        """)
        expected_types = {
            'default::Sample',
            'default::Measurement',
            'default::Assay',
            'default::Calibration',
            'default::Certificate',
            'default::Batch'
        }
        actual_types = {t.name for t in types_after}
        schema_unchanged_after_probe = (actual_types == expected_types)

        # Step 18: Introspection
        raw_introspection = await client.query("""
            select schema::ObjectType {
                name,
                is_abstract,
                properties: {
                    name,
                    cardinality,
                    required,
                    expr,
                    target: { name }
                },
                links: {
                    name,
                    cardinality,
                    required,
                    expr,
                    target: { name }
                }
            } filter .name in {
                'default::Sample',
                'default::Measurement',
                'default::Assay',
                'default::Calibration',
                'default::Certificate',
                'default::Batch'
            }
        """)

        introspection_dict = {}
        for ot in raw_introspection:
            short_name = ot.name.split('::')[-1]
            pointers = {}
            for prop in ot.properties:
                if prop.name in ('id', '__type__'):
                    continue
                pointers[prop.name] = {
                    "cardinality": "One" if prop.cardinality.name in ("ONE", "AT_MOST_ONE") else "Many",
                    "required": prop.required,
                    "computed": prop.expr is not None,
                    "target": prop.target.name
                }
            for link in ot.links:
                if link.name in ('id', '__type__'):
                    continue
                pointers[link.name] = {
                    "cardinality": "One" if link.cardinality.name in ("ONE", "AT_MOST_ONE") else "Many",
                    "required": link.required,
                    "computed": link.expr is not None,
                    "target": link.target.name
                }
            introspection_dict[short_name] = {
                "abstract": ot.is_abstract,
                "pointers": pointers
            }

        # Link properties introspection
        batch_links = await client.query("""
            select schema::ObjectType {
                links: {
                    name,
                    properties: {
                        name,
                        cardinality,
                        required,
                        target: { name }
                    }
                }
            } filter .name = 'default::Batch';
        """)
        samples_link = None
        for link in batch_links[0].links:
            if link.name == 'samples':
                samples_link = link
                break
        
        link_props_dict = {}
        if samples_link:
            for prop in samples_link.properties:
                if prop.name in ('source', 'target'):
                    continue
                link_props_dict[prop.name] = {
                    "cardinality": "One" if prop.cardinality.name in ("ONE", "AT_MOST_ONE") else "Many",
                    "required": prop.required,
                    "target": prop.target.name
                }
        
        link_properties = {
            "Batch.samples": link_props_dict
        }

        # Step 19: Query Samples data
        samples_data = await client.query("""
            select Sample {
                label,
                label_key,
                assay_count,
                measurement_count,
                total_value,
                has_certificate := exists .certificate,
                batch_codes := (
                    with b := .batches
                    select b.code
                    order by b.code
                )
            } order by .label;
        """)
        
        samples_list = []
        for s in samples_data:
            samples_list.append({
                "label": s.label,
                "label_key": s.label_key,
                "assay_count": s.assay_count,
                "measurement_count": s.measurement_count,
                "total_value": s.total_value,
                "has_certificate": s.has_certificate,
                "batch_codes": list(s.batch_codes)
            })

        # Step 20: Query Batch data
        batch_data = await client.query_single("""
            select Batch {
                code,
                sample_count,
                members := (
                    select .samples {
                        label,
                        position := @position
                    } order by @position
                )
            } filter .code = 'BATCH-1';
        """)

        batch_dict = {
            "code": batch_data.code,
            "sample_count": batch_data.sample_count,
            "members": [
                {
                    "label": m.label,
                    "position": m.position
                }
                for m in batch_data.members
            ]
        }

        # Build full report
        report = {
            "introspection": introspection_dict,
            "link_properties": link_properties,
            "defaults": {
                "batch_insert_size": batch_insert_size,
                "distinct_intake_at_in_batch": distinct_intake_at_in_batch,
                "distinct_intake_ref_in_batch": distinct_intake_ref_in_batch,
                "intake_at_unchanged_after_update": intake_at_unchanged_after_update,
                "intake_ref_unchanged_after_update": intake_ref_unchanged_after_update,
                "late_intake_at_not_before_batch": late_intake_at_not_before_batch,
                "readonly_update_rejected": {
                    "rejected": readonly_rejected,
                    "error_class": readonly_error_class,
                    "error_message": readonly_error_message
                }
            },
            "computed": {
                "label_key_before_update": label_key_before_update,
                "label_key_after_update": label_key_after_update,
                "alpha_assay_count_before": alpha_assay_count_before,
                "alpha_measurement_count_before": alpha_measurement_count_before,
                "alpha_total_value_before": alpha_total_value_before,
                "alpha_assay_count_after": alpha_assay_count_after,
                "alpha_measurement_count_after": alpha_measurement_count_after,
                "alpha_total_value_after": alpha_total_value_after,
                "age_non_negative": age_non_negative,
                "age_difference_matches_intake_difference": age_difference_matches_intake_difference
            },
            "volatility": {
                "schema_computed_volatile": {
                    "rejected": schema_computed_volatile_rejected,
                    "error_class": schema_computed_volatile_error_class,
                    "error_message": schema_computed_volatile_error_message
                },
                "cartesian_volatile": {
                    "rejected": cartesian_volatile_rejected,
                    "error_class": cartesian_volatile_error_class,
                    "error_message": cartesian_volatile_error_message
                },
                "schema_unchanged_after_probe": schema_unchanged_after_probe
            },
            "samples": samples_list,
            "batch": batch_dict
        }

        return report

    finally:
        await client.aclose()
