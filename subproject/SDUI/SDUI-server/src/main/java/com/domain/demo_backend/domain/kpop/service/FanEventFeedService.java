package com.domain.demo_backend.domain.kpop.service;

import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

/** Read-only projection. Region classification is registered data, not newly verified event evidence. */
@Service
public class FanEventFeedService {
    private final EventCatalogService catalog;
    private final NamedParameterJdbcTemplate jdbc;
    public FanEventFeedService(EventCatalogService catalog, NamedParameterJdbcTemplate jdbc) {this.catalog=catalog;this.jdbc=jdbc;}
    private static final Map<String,String> COUNTRIES=Map.ofEntries(
        Map.entry("일본","JP"),Map.entry("미국","US"),Map.entry("페루","PE"),Map.entry("태국","TH"),Map.entry("대만","TW"),Map.entry("홍콩","HK"),Map.entry("캐나다","CA"),Map.entry("칠레","CL"),Map.entry("마카오","MO"),Map.entry("영국","GB"),Map.entry("싱가포르","SG"),Map.entry("네덜란드","NL"),Map.entry("아르헨티나","AR"),Map.entry("프랑스","FR"),Map.entry("덴마크","DK"),Map.entry("베트남","VN"),Map.entry("독일","DE"),Map.entry("브라질","BR"),Map.entry("호주","AU"),Map.entry("멕시코","MX"),Map.entry("인도네시아","ID"),Map.entry("말레이시아","MY"),Map.entry("스웨덴","SE"),Map.entry("이탈리아","IT"),Map.entry("스페인","ES"),Map.entry("필리핀","PH"));
    private static final Set<String> KOREA=Set.of("대한민국","한국","서울","서울특별시","경기","경기도","부산","부산광역시","인천","대구","대전","광주","울산","세종","강원","강원도","강원특별자치도","충북","충청북도","충남","충청남도","전북","전라북도","전북특별자치도","전남","전라남도","경북","경상북도","경남","경상남도","제주","제주특별자치도");
    public static Map<String,Object> location(Object raw) {
        String region=raw==null?"":raw.toString().trim();
        String geo=region.equals("온라인")?"online":KOREA.contains(region)?"domestic":COUNTRIES.containsKey(region)?"overseas":"unknown";
        return Map.of("geography",geo,"countryCode",geo.equals("domestic")?"KR":COUNTRIES.getOrDefault(region,""),"locationBasis","registered_region");
    }
    public Map<String,Object> feed(Long owner,String artist,String geo,String country,String from,String to,int page) {
        if(!Set.of("all","domestic","overseas","online","unknown").contains(geo)||page<1||page>100000)throw bad();
        long artistId=0;
        if(artist!=null&&!artist.isBlank()) {try{if(!artist.matches("[1-9][0-9]{0,17}"))throw bad();artistId=Long.parseLong(artist);}catch(NumberFormatException ex){throw bad();}}
        String code=country==null?"":country.trim();
        if(!code.isEmpty()&&(!geo.equals("overseas")||!COUNTRIES.containsValue(code)))throw bad();
        var today=catalog.today();
        List<Map<String,Object>> all=catalog.events(null,from,to,owner,today);
        List<Map<String,Object>> artists=jdbc.queryForList("SELECT a.artist_id AS id,a.name_ko AS name FROM artist a WHERE a.approved_yn='Y'"+(owner==null?"":" AND EXISTS (SELECT 1 FROM artist_follow f WHERE f.artist_id=a.artist_id AND f.user_sqno=:owner)")+" ORDER BY a.artist_id",owner==null?Map.of():Map.of("owner",owner));
        long selected=artistId;
        List<Map<String,Object>> cohort=all.stream().filter(x->owner==null||Boolean.TRUE.equals(x.get("followed"))).filter(x->selected==0||((Number)x.get("artistId")).longValue()==selected).map(x->{var v=new LinkedHashMap<String,Object>(x);v.putAll(location(x.get("region")));v.put("dateBasis","registered_date");return (Map<String,Object>)v;}).sorted(Comparator.comparing((Map<String,Object>x)->x.get("date").toString()).thenComparingLong(x->((Number)x.get("id")).longValue())).toList();
        Map<String,Long> counts=new LinkedHashMap<>();for(String g:List.of("all","domestic","overseas","online","unknown"))counts.put(g,g.equals("all")?(long)cohort.size():cohort.stream().filter(x->g.equals(x.get("geography"))).count());
        Map<String,String> countries=new TreeMap<>();for(var x:cohort)if(x.get("geography").equals("overseas"))countries.put(x.get("countryCode").toString(),x.get("region").toString());
        List<Map<String,Object>> filtered=cohort.stream().filter(x->geo.equals("all")||geo.equals(x.get("geography"))).filter(x->code.isEmpty()||code.equals(x.get("countryCode"))).toList();
        int start=Math.min((page-1)*12,filtered.size());
        Map<String,Object> out=new LinkedHashMap<>();out.put("items",filtered.subList(start,Math.min(start+12,filtered.size())));out.put("totalCount",filtered.size());out.put("page",page);out.put("pageSize",12);out.put("artists",artists);out.put("counts",counts);out.put("countries",countries);out.put("today",today.toString());out.put("dateBasis","registered_date");out.put("audience",owner==null?"all":"mine");return out;
    }
    private ResponseStatusException bad(){return new ResponseStatusException(HttpStatus.BAD_REQUEST,"일정 검색 조건을 확인해 주세요.");}
}
