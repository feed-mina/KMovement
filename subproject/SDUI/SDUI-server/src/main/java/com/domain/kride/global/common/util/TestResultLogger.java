package com.domain.kride.global.common.util;


import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.time.LocalDateTime;
public class TestResultLogger {
    // 로그가 저장될 폴더와 파일 경로 정의
    private static final String DIR_PATH = "tests/logs";
    private static final String FILE_PATH = DIR_PATH + "/backend-performance.log";

    public static void log(String testName, long queryCount) {
        // 1. 폴더가 없으면 생성한다.
        File directory = new File(DIR_PATH);
        if (!directory.exists()) {
            directory.mkdirs(); // mkdirs는 상위 폴더까지 한꺼번에 만들어준다.
        }
        try (FileWriter fw = new FileWriter(FILE_PATH, true);
             PrintWriter pw = new PrintWriter(fw)) {
            // 1. 현재 시간을 기록한다.
            pw.print("[" + LocalDateTime.now() + "] ");
            // 2. 실행된 테스트 명칭을 기록한다.
            pw.print("Test: " + testName + " | ");
            // 3. 우리가 측정한 쿼리 수를 기록한다.
            pw.println("Query Count: " + queryCount);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}