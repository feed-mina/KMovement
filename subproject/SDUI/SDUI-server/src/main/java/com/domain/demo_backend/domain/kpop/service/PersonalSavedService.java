package com.domain.demo_backend.domain.kpop.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.*;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@Service
@RequiredArgsConstructor
public class PersonalSavedService {
    private final NamedParameterJdbcTemplate jdbc;
    private record Kind(String table,String ref,String id,String extra) {}
    private Kind kind(String name) {
        return switch(name) {
            case "artists" -> new Kind("artist_follow","artist_id","artist_follow_id","");
            case "events" -> new Kind("event_bookmark","event_id","event_bookmark_id","");
            case "products" -> new Kind("saved_item","item_ref","saved_item_id"," AND s.item_type='PRODUCT_CANDIDATE'");
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid saved category.");
        };
    }
    private MapSqlParameterSource params(Long user,String name) {
        if(user==null)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Login required.");
        return new MapSqlParameterSource("uid",user).addValue("kind",name);
    }
    private void ref(Long ref) {if(ref==null||ref<=0)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid reference.");}
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> page(String name,int requestedPage,Long user) {
        Kind k=kind(name);var p=params(user,name);
        if(requestedPage<1||requestedPage>1_000_000)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid page.");
        Long count=jdbc.queryForObject("SELECT COUNT(*) FROM "+k.table+" s WHERE s.user_sqno=:uid"+k.extra,p,Long.class);
        long total=count==null?0:count;int last=(int)Math.max(1,(total+4)/5),page=Math.min(requestedPage,last);
        p.addValue("offset",(page-1)*5);
        var rows=jdbc.queryForList("SELECT s."+k.id+" AS id,s."+k.ref+" AS \"itemRef\",CAST(s.created_at AS text) AS \"createdAt\","
                +"COALESCE(v.visibility,'PRIVATE') AS visibility,CASE WHEN v.visibility='PUBLIC' THEN v.title ELSE '비공개 항목' END AS title "
                +"FROM "+k.table+" s LEFT JOIN kpop_saved_catalog v ON v.kind=:kind AND v.item_ref=s."+k.ref
                +" WHERE s.user_sqno=:uid"+k.extra+" ORDER BY s.created_at DESC,s."+k.id+" DESC LIMIT 5 OFFSET :offset",p);
        return Map.of("items",rows,"totalCount",total,"page",page,"pageSize",5,"kind",name);
    }
    public Map<String,Object> state(String name,Long itemRef,Long user) {
        Kind k=kind(name);ref(itemRef);var p=params(user,name).addValue("ref",itemRef);
        var rows=jdbc.queryForList("SELECT s."+k.id+" AS id,COALESCE(v.visibility,'PRIVATE') AS visibility FROM "+k.table
                +" s LEFT JOIN kpop_saved_catalog v ON v.kind=:kind AND v.item_ref=s."+k.ref
                +" WHERE s.user_sqno=:uid AND s."+k.ref+"=:ref"+k.extra,p);
        return rows.isEmpty()?Map.of("saved",false):Map.of("saved",true,"id",rows.get(0).get("id"),"visibility",rows.get(0).get("visibility"));
    }
    @Transactional
    public Map<String,Object> save(String name,Long itemRef,Long user) {
        Kind k=kind(name);ref(itemRef);var p=params(user,name).addValue("ref",itemRef);
        boolean product=name.equals("products");
        String columns="user_sqno,"+(product?"item_type,":"")+k.ref;
        var ids=jdbc.queryForList("INSERT INTO "+k.table+" ("+columns+") SELECT :uid,"+(product?"'PRODUCT_CANDIDATE',":"")
                +"v.item_ref FROM kpop_saved_catalog v WHERE v.kind=:kind AND v.item_ref=:ref AND v.visibility='PUBLIC'"
                +" ON CONFLICT ("+columns+") DO UPDATE SET "+k.ref+"=EXCLUDED."+k.ref+" RETURNING "+k.id,p,Long.class);
        if(ids.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Public item not found.");
        return Map.of("saved",true,"id",ids.get(0),"itemRef",itemRef);
    }
    @Transactional
    public Map<String,Object> remove(String name,Long itemRef,Long user) {
        Kind k=kind(name);ref(itemRef);var p=params(user,name).addValue("ref",itemRef);
        // The reference is never a caller-selected owner. A missing row and another owner's row are indistinguishable.
        jdbc.update("DELETE FROM "+k.table+" s WHERE s.user_sqno=:uid AND s."+k.ref+"=:ref"+k.extra,p);
        return Map.of("saved",false,"itemRef",itemRef);
    }
}
