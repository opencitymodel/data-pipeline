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
        String fmt = args[3];

        int lod = CitygmlBuilder.LOD1;
        String format = fmt == null ? CitygmlBuilder.CITYGML : fmt;

        boolean heightToDegrees = System.getenv("HEIGHT_TO_DEGREES") != null;
        Main main = new Main(outdir, outfile, lod, format, 40000, heightToDegrees);

        // glob through files and try to process the relevant ones
        File file = new File(indir);
        if (file.isDirectory()) {
            System.out.println("Directory of files");
            try (Stream<Path> paths = Files.walk(Paths.get(indir))) {
                paths.forEach(p -> {
                    if (p.toFile().isFile() && p.toAbsolutePath().toString().endsWith(".json")) {
                        main.processFile(p.toString());
                    }
                });
            } catch (IOException ioe) {
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


    public Main(String path, String name, int lod, String format, int maxBuildings, boolean heightToDegrees) {
        this.path = path;
        this.name = name;
        this.builder = new CitygmlBuilder(lod, format, heightToDegrees);
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
        } catch(Exception ex) {
            ex.printStackTrace();
            System.exit(1);
        }
    }

    public void writeCitygml() {
        if (this.builder.getNumBuildings() == 0) {
            System.out.println("No buildings found to write.");
            return;
        }

        try {
            String outfile = this.name + "-" + String.format("%03d", this.index);
            System.out.println(String.format("Writing %d buildings to file %s", this.builder.getNumBuildings(), outfile));
            this.builder.writeFile(this.path, outfile);
            // upload it to s3, delete it
            this.builder = new CitygmlBuilder(this.builder.getLod(), this.builder.getFormat(), this.builder.getHeightToDegrees());
            this.index++;
        } catch(Exception ex) {
            ex.printStackTrace();
            System.exit(1);
        }
    }
}
