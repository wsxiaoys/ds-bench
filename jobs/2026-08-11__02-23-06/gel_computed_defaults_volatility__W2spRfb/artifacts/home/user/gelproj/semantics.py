import asyncio
import json
import gel

async def get_schema_structure(client):
    res = await client.query("""
        select schema::ObjectType {
            name,
            pointers: {
                name
            }
        } filter .name like 'default::%' order by .name
    """)
    return [(t.name, sorted([p.name for p in t.pointers])) for t in res]

async def build_report() -> dict:
    client = gel.create_async_client()
    try:
        # 1. Delete existing data to ensure repeatability
        await client.execute("""
            delete Batch;
            delete Certificate;
            delete Measurement;
            delete Sample;
        """)

        # 2. Insert four Samples created by one single EdgeQL statement
        batch_data = [
            {"label": "Alpha-01", "grams": 1.5},
            {"label": "Bravo-02", "grams": 2.25},
            {"label": "Charlie-03", "grams": 3.0},
            {"label": "Delta-04", "grams": 4.75}
        ]
        inserted_batch = await client.query("""
            with data := <json>$data
            for item in json_array_unpack(data) union (
                insert Sample {
                    label := <str>item['label'],
                    grams := <float64>item['grams']
                }
            ) {
                label,
                intake_ref,
                intake_at
            }
        """, data=json.dumps(batch_data))

        # 3. Insert Echo-05 in a later, separate statement
        echo_sample = await client.query_single("""
            select (insert Sample {
                label := 'Echo-05',
                grams := 5.5
            }) {
                label,
                intake_ref,
                intake_at
            }
        """)

        # 4. Query Alpha-01's computed pointers while no measurements exist yet
        alpha_before = await client.query_single("""
            select Sample {
                assay_count,
                measurement_count,
                total_value
            } filter .label = 'Alpha-01'
        """)

        # 5. Insert Assays and Calibrations
        await client.execute("""
            insert Assay { code := 'A1', sample := (select Sample filter .label = 'Alpha-01'), value := 10.0 };
            insert Assay { code := 'A2', sample := (select Sample filter .label = 'Alpha-01'), value := 2.5 };
            insert Assay { code := 'A3', sample := (select Sample filter .label = 'Bravo-02'), value := 7.25 };
            insert Calibration { code := 'C1', sample := (select Sample filter .label = 'Alpha-01'), bias := 0.5 };
            insert Calibration { code := 'C2', sample := (select Sample filter .label = 'Charlie-03'), bias := -1.25 };
        """)

        # 6. Query Alpha-01's computed pointers after measurements exist
        alpha_after = await client.query_single("""
            select Sample {
                assay_count,
                measurement_count,
                total_value
            } filter .label = 'Alpha-01'
        """)

        # 7. Insert Certificate
        await client.execute("""
            insert Certificate { serial := 'CERT-ALPHA', sample := (select Sample filter .label = 'Alpha-01') };
        """)

        # 8. Insert Batch BATCH-1
        await client.execute("""
            insert Batch {
                code := 'BATCH-1',
                samples := (
                    select Sample {
                        @position := 1 if .label = 'Alpha-01' else
                                     2 if .label = 'Bravo-02' else
                                     3 if .label = 'Charlie-03' else
                                     <int64>{}
                    } filter .label in {'Alpha-01', 'Bravo-02', 'Charlie-03'}
                )
            }
        """)

        # 9. Query Delta-04 before update
        delta_before = await client.query_single("""
            select Sample {
                label_key,
                intake_ref,
                intake_at
            } filter .label = 'Delta-04'
        """)

        # 10. Update Delta-04 to Zulu-99
        zulu_after = await client.query_single("""
            select assert_single((update Sample filter .label = 'Delta-04' set {
                label := 'Zulu-99',
                grams := 9.0
            })) {
                label,
                label_key,
                intake_ref,
                intake_at
            }
        """)

        # 11. Read age difference matches intake difference within one single statement
        age_diff_match = await client.query_single("""
            with
                alpha := (select Sample filter .label = 'Alpha-01'),
                echo := (select Sample filter .label = 'Echo-05')
            select
                alpha.age - echo.age = echo.intake_at - alpha.intake_at
        """)

        # 12. Readonly update probe on intake_at of an existing sample
        readonly_rejected = False
        readonly_error_class = ""
        readonly_error_message = ""
        try:
            await client.execute("update Sample filter .label = 'Echo-05' set { intake_at := datetime_current() }")
        except Exception as e:
            readonly_rejected = True
            readonly_error_class = type(e).__name__
            readonly_error_message = str(e)

        # 13. Schema structure before volatility probes
        schema_before = await get_schema_structure(client)

        # 14. Volatility probe 1: schema_computed_volatile
        computed_volatile_rejected = False
        computed_volatile_error_class = ""
        computed_volatile_error_message = ""
        try:
            await client.execute("configure current branch set allow_bare_ddl := 'AlwaysAllow'")
            try:
                await client.execute("alter type Sample { create property some_volatile_prop := std::uuid_generate_v4() }")
            except Exception as e:
                computed_volatile_rejected = True
                computed_volatile_error_class = type(e).__name__
                computed_volatile_error_message = str(e)
            finally:
                await client.execute("configure current branch set allow_bare_ddl := 'NeverAllow'")
        except Exception as e:
            computed_volatile_rejected = True
            computed_volatile_error_class = type(e).__name__
            computed_volatile_error_message = str(e)

        # 15. Volatility probe 2: cartesian_volatile
        cartesian_volatile_rejected = False
        cartesian_volatile_error_class = ""
        cartesian_volatile_error_message = ""
        try:
            await client.query("select ({1, 2, 3}, std::uuid_generate_v4())")
        except Exception as e:
            cartesian_volatile_rejected = True
            cartesian_volatile_error_class = type(e).__name__
            cartesian_volatile_error_message = str(e)

        # 16. Schema structure after volatility probes
        schema_after = await get_schema_structure(client)
        schema_unchanged = (schema_before == schema_after)

        # 17. Introspection data
        introspection_types_res = await client.query("""
            select schema::ObjectType {
                name,
                is_abstract,
                pointers: {
                    name,
                    cardinality,
                    required,
                    expr,
                    target: { name }
                }
            } filter .name like 'default::%'
        """)

        introspection_dict = {}
        for t in introspection_types_res:
            short_name = t.name.split('::')[-1]
            pointers_dict = {}
            for p in t.pointers:
                if p.name in ('id', '__type__'):
                    continue
                pointers_dict[p.name] = {
                    "cardinality": p.cardinality.value if hasattr(p.cardinality, 'value') else str(p.cardinality),
                    "required": p.required,
                    "computed": p.expr is not None,
                    "target": p.target.name
                }
            introspection_dict[short_name] = {
                "abstract": t.is_abstract,
                "pointers": pointers_dict
            }

        # 18. Link properties metadata
        link_properties_res = await client.query_single("""
            select assert_single(schema::ObjectType filter .name = 'default::Batch') {
                links: {
                    name,
                    properties: {
                        name,
                        cardinality,
                        required,
                        target: { name }
                    }
                }
            }
        """)

        link_props_dict = {}
        if link_properties_res and link_properties_res.links:
            for link in link_properties_res.links:
                if link.name == "samples":
                    pos_prop = None
                    for prop in link.properties:
                        if prop.name == "position":
                            pos_prop = prop
                            break
                    if pos_prop:
                        link_props_dict["Batch.samples"] = {
                            "position": {
                                "cardinality": pos_prop.cardinality.value if hasattr(pos_prop.cardinality, 'value') else str(pos_prop.cardinality),
                                "required": pos_prop.required,
                                "target": pos_prop.target.name
                            }
                        }

        # 19. Retrieve final samples and batch data for the report
        final_samples_res = await client.query("""
            select Sample {
                label,
                label_key,
                age,
                assay_count,
                measurement_count,
                total_value,
                has_certificate := exists .certificate,
                batch_codes := (select .batches.code)
            } order by .label
        """)

        samples_list = []
        for s in final_samples_res:
            samples_list.append({
                "label": s.label,
                "label_key": s.label_key,
                "assay_count": s.assay_count,
                "measurement_count": s.measurement_count,
                "total_value": float(s.total_value),
                "has_certificate": s.has_certificate,
                "batch_codes": sorted(list(s.batch_codes))
            })

        final_batch_res = await client.query_single("""
            select Batch {
                code,
                sample_count,
                members := (
                    select .samples {
                        label,
                        position := @position
                    } order by @position
                )
            } filter .code = 'BATCH-1'
        """)

        batch_dict = {}
        if final_batch_res:
            batch_dict = {
                "code": final_batch_res.code,
                "sample_count": final_batch_res.sample_count,
                "members": [
                    {"label": m.label, "position": m.position}
                    for m in final_batch_res.members
                ]
            }

        # Determine age non-negativity
        age_non_negative = all(s.age.total_seconds() >= 0 for s in final_samples_res)

        # 20. Build the final report dict
        report = {
            "introspection": introspection_dict,
            "link_properties": link_props_dict,
            "defaults": {
                "batch_insert_size": len(inserted_batch),
                "distinct_intake_at_in_batch": len(set(s.intake_at for s in inserted_batch)),
                "distinct_intake_ref_in_batch": len(set(s.intake_ref for s in inserted_batch)),
                "intake_at_unchanged_after_update": (delta_before.intake_at == zulu_after.intake_at),
                "intake_ref_unchanged_after_update": (delta_before.intake_ref == zulu_after.intake_ref),
                "late_intake_at_not_before_batch": (echo_sample.intake_at >= inserted_batch[0].intake_at),
                "readonly_update_rejected": {
                    "rejected": readonly_rejected,
                    "error_class": readonly_error_class,
                    "error_message": readonly_error_message
                }
            },
            "computed": {
                "label_key_before_update": delta_before.label_key,
                "label_key_after_update": zulu_after.label_key,
                "alpha_assay_count_before": alpha_before.assay_count,
                "alpha_measurement_count_before": alpha_before.measurement_count,
                "alpha_total_value_before": float(alpha_before.total_value),
                "alpha_assay_count_after": alpha_after.assay_count,
                "alpha_measurement_count_after": alpha_after.measurement_count,
                "alpha_total_value_after": float(alpha_after.total_value),
                "age_non_negative": age_non_negative,
                "age_difference_matches_intake_difference": age_diff_match
            },
            "volatility": {
                "schema_computed_volatile": {
                    "rejected": computed_volatile_rejected,
                    "error_class": computed_volatile_error_class,
                    "error_message": computed_volatile_error_message
                },
                "cartesian_volatile": {
                    "rejected": cartesian_volatile_rejected,
                    "error_class": cartesian_volatile_error_class,
                    "error_message": cartesian_volatile_error_message
                },
                "schema_unchanged_after_probe": schema_unchanged
            },
            "samples": samples_list,
            "batch": batch_dict
        }

        return report

    finally:
        await client.aclose()
