package org.opencitymodel.citygml;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.stream.Stream;

import com.google.gson.Gson;


public class Main {

    public static void main(String[] args) {
        String indir = args[0];
        String outdir = args[1];
        String outfile = args[2];
        int lod = CitygmlBuilder.LOD1;

        Main main = new Main(outdir, outfile, lod, 40000);

        // glob through files and try to process the relevant ones
        File file = new File(indir);
        if (file.isDirectory()) {
            System.out.println("Directory of files");
            try (Stream<Path> paths = Files.walk(Paths.get(indir))) {
                paths.forEach(p -> {
                    if(p.toFile().isFile() && p.toAbsolutePath().toString().endsWith(".json")) {
                        main.processFile(p.toString());
                    }
                });
            } catch(IOException ioe) {
                ioe.printStackTrace();
            }
        } else if (file.isFile()) {
            System.out.println("Single file");
            // single file to work on
            main.processFile(indir);
        }

        // always write anything we have buffered at the end of our work
        main.writeCitygml();
    }


    private final Gson gson = new Gson();
    private final int MAX_BUILDINGS;

    private final String path;
    private final String name;

    private int index = 0;
    private CitygmlBuilder builder;


    public Main(String path, String name, int lod, int maxBuildings) {
        this.path = path;
        this.name = name;
        this.builder = new CitygmlBuilder(lod);
        this.MAX_BUILDINGS = maxBuildings;
    }


    public void processFile(String path) {
        System.out.println("processing: "+path);
        try {
            FileReader fileReader = new FileReader(new File(path));
            BufferedReader bufferedReader = new BufferedReader(fileReader);

            String line;
            while ((line = bufferedReader.readLine()) != null) {
                BuildingDef bldg = gson.fromJson(line, BuildingDef.class);

                this.builder.addBuilding(bldg);

                if (this.builder.getNumBuildings() >= MAX_BUILDINGS) {
                    this.writeCitygml();
                }
            }

            fileReader.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public void writeCitygml() {
        String outfile = this.path + "/" + this.name + "-" + String.format("%03d", this.index) + ".gml";
        System.out.println(String.format("Writing %d buildings to file %s", this.builder.getNumBuildings(), outfile));
        this.builder.writeFile(outfile);
        this.builder = new CitygmlBuilder(this.builder.getLod());
        this.index++;
    }
}
