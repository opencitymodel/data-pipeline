FROM amazonlinux:latest

RUN yum -y install aws-cli java-1.8.0
RUN yum remove java-1.7.0-openjdk
ADD build-citygml.sh /tmp/build-citygml.sh
ADD target/citygml-*-jar-with-dependencies.jar /tmp/citygml.jar
RUN chmod 755 /tmp/*.sh
WORKDIR /tmp
USER nobody

ENTRYPOINT ["/tmp/build-citygml.sh"]